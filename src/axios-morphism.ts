import { morphism, Schema, StrictSchema } from 'morphism';
import { AxiosResponse, AxiosInstance, AxiosRequestConfig } from 'axios';
import urljoin from 'url-join';
import { pathToRegexp } from 'path-to-regexp';

type ResponseFunctionMatcher = (response: AxiosResponse) => boolean;
type RequestFunctionMatcher = (request: AxiosRequestConfig) => boolean;

enum TransformerType {
  Reponse,
  Request
}
type FunctionMatcher<T = any> = T extends TransformerType.Reponse ? ResponseFunctionMatcher : RequestFunctionMatcher;
type Matcher<T = any> = string | RegExp | FunctionMatcher<T>;
interface TransformerConfiguration<T extends TransformerType> {
  matcher: Matcher<T>;
  schema: Schema<any> | StrictSchema<any>;
  dataSelector?: string;
}
type ResponseTransformerConfiguration = TransformerConfiguration<TransformerType.Reponse>;
type RequestTransformerConfiguration = TransformerConfiguration<TransformerType.Request>;
type InterceptorConfiguration = ResponseTransformerConfiguration | RequestTransformerConfiguration;
export interface AxiosMorphismConfiguration {
  url: string;
  interceptors: {
    requests: RequestTransformerConfiguration[];
    responses: ResponseTransformerConfiguration[];
  };
}

// Helpers
function isFunctionMatcher(matcher: Matcher): matcher is ResponseFunctionMatcher | RequestFunctionMatcher {
  return matcher instanceof Function;
}
function isRegExpMatcher(matcher: Matcher): matcher is RegExp {
  return matcher instanceof RegExp;
}
function isStringMatcher(matcher: Matcher): matcher is string {
  return typeof matcher === 'string';
}

enum AxiosType {
  AxiosResponse = 'AxiosReponse',
  AxiosRequest = 'AxiosRequest'
}
function isAxiosResponse(requestOrResponse: any): requestOrResponse is AxiosResponse {
  return requestOrResponse[axiosTypeSymbol] === AxiosType.AxiosResponse;
}

const axiosTypeSymbol = Symbol('AxiosType');
function createAxiosResponseCallback(callback: (response: AxiosResponse) => AxiosResponse) {
  return (response: AxiosResponse & { [axiosTypeSymbol]?: AxiosType }) => {
    response[axiosTypeSymbol] = AxiosType.AxiosResponse;
    return callback(response);
  };
}

function createAxiosRequestCallback(callback: (request: AxiosRequestConfig) => AxiosRequestConfig) {
  return (request: AxiosRequestConfig & { [axiosTypeSymbol]?: AxiosType }) => {
    request[axiosTypeSymbol] = AxiosType.AxiosRequest;
    return callback(request);
  };
}

function applyMorphism(transformerConfiguration: InterceptorConfiguration, axiosInput: any) {
  const { schema, dataSelector } = transformerConfiguration;
  if (dataSelector) {
    const data = axiosInput.data[dataSelector];
    axiosInput.data[dataSelector] = morphism(schema, data);
  } else {
    axiosInput.data = morphism(schema, axiosInput.data);
  }
  return axiosInput;
}

function applyFunctionMatcher(transformerConfiguration: InterceptorConfiguration, responseOrRequest: AxiosRequestConfig | AxiosResponse) {
  const hasMatched = (<any>transformerConfiguration.matcher)(responseOrRequest);
  if (hasMatched) {
    return applyMorphism(transformerConfiguration, responseOrRequest);
  }
  return responseOrRequest;
}
function applyRegExpMatcher(transformerConfiguration: InterceptorConfiguration, responseOrRequest: AxiosRequestConfig | AxiosResponse) {
  let url = isAxiosResponse(responseOrRequest) ? responseOrRequest.config.url : responseOrRequest.url;
  if (url && (<any>transformerConfiguration.matcher).test(url)) {
    return applyMorphism(transformerConfiguration, responseOrRequest);
  }
  return responseOrRequest;
}
function applyStringMatcher(
  baseURL: string,
  transformerConfiguration: InterceptorConfiguration,
  responseOrRequest: AxiosRequestConfig | AxiosResponse
) {
  const finalPath = urljoin(baseURL, <string>transformerConfiguration.matcher);
  const regExp = pathToRegexp(finalPath);
  const url = isAxiosResponse(responseOrRequest) ? responseOrRequest.config.url : responseOrRequest.url;
  if (url && regExp.test(url)) {
    return applyMorphism(transformerConfiguration, responseOrRequest);
  }
  return responseOrRequest;
}

function createResponseTransformer(baseUrl: string, transformerConfiguration: ResponseTransformerConfiguration) {
  const matcher = transformerConfiguration.matcher;
  if (isFunctionMatcher(matcher)) {
    return createAxiosResponseCallback(response => applyFunctionMatcher(transformerConfiguration, response));
  } else if (isRegExpMatcher(matcher)) {
    return createAxiosResponseCallback(response => applyRegExpMatcher(transformerConfiguration, response));
  } else if (isStringMatcher(matcher)) {
    return createAxiosResponseCallback(response => applyStringMatcher(baseUrl, transformerConfiguration, response));
  }
}

function createRequestTransformer(baseUrl: string, transformerConfiguration: RequestTransformerConfiguration) {
  const { matcher } = transformerConfiguration;
  if (isFunctionMatcher(matcher)) {
    return createAxiosRequestCallback(request => applyFunctionMatcher(transformerConfiguration, request));
  } else if (isRegExpMatcher(matcher)) {
    return createAxiosRequestCallback(request => applyRegExpMatcher(transformerConfiguration, request));
  } else if (isStringMatcher(matcher)) {
    return createAxiosRequestCallback(request => applyStringMatcher(baseUrl, transformerConfiguration, request));
  }
}
function createResponseInterceptor(baseUrl: string, transformerConfiguration: ResponseTransformerConfiguration) {
  const transformer = createResponseTransformer(baseUrl, transformerConfiguration);
  return createAxiosResponseCallback(response => {
    if (transformer) {
      return transformer(response);
    }
    return response;
  });
}

function createRequestInterceptor(baseUrl: string, transformerConfiguration: RequestTransformerConfiguration) {
  const transformer = createRequestTransformer(baseUrl, transformerConfiguration);
  return (request: AxiosRequestConfig) => {
    if (transformer) {
      return transformer(request);
    }
    return request;
  };
}

function createInterceptors(configuration: AxiosMorphismConfiguration) {
  const { url } = configuration;
  const { requests, responses } = configuration.interceptors;
  const responseInterceptors = responses.map(transformerConfiguration => createResponseInterceptor(url, transformerConfiguration));
  const requestInterceptors = requests.map(transformerConfiguration => createRequestInterceptor(url, transformerConfiguration));
  return { responses: responseInterceptors, requests: requestInterceptors };
}

export function apply(client: AxiosInstance, ...configurations: AxiosMorphismConfiguration[]) {
  const subscriptions = configurations.map(configuration => {
    const { responses, requests } = createInterceptors(configuration);
    const responseIds = responses.map(interceptor => client.interceptors.response.use(interceptor));
    const requestIds = requests.map(interceptor => client.interceptors.request.use(interceptor));
    return { responsesSubscriptions: responseIds, requestsSubscriptions: requestIds };
  });
  return {
    unsubscribe: () => {
      subscriptions.forEach(subscription => {
        subscription.responsesSubscriptions.forEach(id => {
          client.interceptors.response.eject(id);
        });
        subscription.requestsSubscriptions.forEach(id => {
          client.interceptors.request.eject(id);
        });
      });
    }
  };
}

export function combine(baseURL: string, ...configurations: AxiosMorphismConfiguration[]) {
  const initialValue: AxiosMorphismConfiguration = { url: baseURL, interceptors: { requests: [], responses: [] } };
  return configurations.reduce((rootConfiguration, configuration) => {
    const configurationsMatcherString = configuration.interceptors.responses
      .filter(c => isStringMatcher(c.matcher))
      .map(config => ({ ...config, matcher: urljoin(configuration.url, (<string>config.matcher).replace(/\/$/, '')) }));

    const configurationsMatcherFunction = configuration.interceptors.responses.filter(c => isFunctionMatcher(c.matcher));

    const configurationsRegExpMatcher = configuration.interceptors.responses.filter(c => isRegExpMatcher(c.matcher));

    rootConfiguration.interceptors.responses.push(
      ...configurationsMatcherFunction,
      ...configurationsMatcherString,
      ...configurationsRegExpMatcher
    );
    return rootConfiguration;
  }, initialValue);
}

export default { apply, combine };
