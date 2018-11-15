import { morphism, Schema, StrictSchema } from 'morphism';
import { AxiosResponse, AxiosInstance, AxiosRequestConfig } from 'axios';
import * as urljoin from 'url-join';
import * as pathToRegexp from 'path-to-regexp';

type ResponseMatcherFunction = (response: AxiosResponse) => boolean;
type RequestMatcherFunction = (request: AxiosRequestConfig) => boolean;

enum TransformerType {
  Reponse,
  Request
}
type MatcherFunction<T> = T extends TransformerType.Reponse ? ResponseMatcherFunction : RequestMatcherFunction;
type Matcher<T = any> = string | RegExp | MatcherFunction<T>;
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

export function combine(baseURL: string, ...configurations: AxiosMorphismConfiguration[]) {
  const initialValue: AxiosMorphismConfiguration = { url: baseURL, interceptors: { requests: [], responses: [] } };
  return configurations.reduce((rootConfiguration, configuration) => {
    const configurationsMatcherString = configuration.interceptors.responses
      .filter(c => isStringMatcher(c.matcher))
      .map(config => ({ ...config, matcher: urljoin(configuration.url, (<string>config.matcher).replace(/\/$/, '')) }));

    const configurationsMatcherFunction = configuration.interceptors.responses.filter(
      c => c.matcher instanceof Function
    );

    rootConfiguration.interceptors.responses.push(...configurationsMatcherFunction, ...configurationsMatcherString);
    return rootConfiguration;
  }, initialValue);
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

function createAxiosResponseCallback(callback: (response: AxiosResponse) => AxiosResponse) {
  return (response: AxiosResponse) => callback(response);
}

function createAxiosRequestCallback(callback: (request: AxiosRequestConfig) => AxiosRequestConfig) {
  return (request: AxiosRequestConfig) => callback(request);
}

function createTransformer(baseUrl: string, transformerConfiguration: ResponseTransformerConfiguration) {
  const matcher = transformerConfiguration.matcher;
  if (isFunctionMatcher(matcher)) {
    return createAxiosResponseCallback(response => {
      const hasMatched = matcher(response);
      if (hasMatched) {
        return applyMorphism(transformerConfiguration, response);
      }
      return response;
    });
  } else if (isRegExpMatcher(matcher)) {
    return createAxiosResponseCallback(response => {
      const url = response.config.url;
      if (url && matcher.test(url)) {
        return applyMorphism(transformerConfiguration, response);
      }
      return response;
    });
  } else if (isStringMatcher(matcher)) {
    const finalPath = urljoin(baseUrl, matcher);
    const regExp = pathToRegexp(finalPath);
    return createAxiosResponseCallback(response => {
      const url = response.config.url;
      if (url && regExp.test(url)) {
        return applyMorphism(transformerConfiguration, response);
      }
      return response;
    });
  }
}

function createRequestTransformer(baseUrl: string, transformerConfiguration: RequestTransformerConfiguration) {
  const matcher = transformerConfiguration.matcher;
  if (isFunctionMatcher(matcher)) {
    return createAxiosRequestCallback(request => {
      const hasMatched = matcher(request);
      if (hasMatched) {
        return applyMorphism(transformerConfiguration, request);
      }
      return request;
    });
  } else if (isRegExpMatcher(matcher)) {
    return createAxiosRequestCallback(request => {
      const url = request.url;
      if (url && matcher.test(url)) {
        return applyMorphism(transformerConfiguration, request);
      }
      return request;
    });
  } else if (isStringMatcher(matcher)) {
    const finalPath = urljoin(baseUrl, matcher);
    const regExp = pathToRegexp(finalPath);
    return createAxiosRequestCallback(request => {
      const url = request.url;
      if (url && regExp.test(url)) {
        return applyMorphism(transformerConfiguration, request);
      }
      return request;
    });
  }
}
function createResponseInterceptor(baseUrl: string, transformerConfiguration: ResponseTransformerConfiguration) {
  const transformer = createTransformer(baseUrl, transformerConfiguration);
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
  const responseInterceptors = responses.map(transformerConfiguration =>
    createResponseInterceptor(url, transformerConfiguration)
  );
  const requestInterceptors = requests.map(transformerConfiguration =>
    createRequestInterceptor(url, transformerConfiguration)
  );
  return { responses: responseInterceptors, requests: requestInterceptors };
}

export function apply(client: AxiosInstance, ...configurations: AxiosMorphismConfiguration[]) {
  configurations.forEach(configuration => {
    const { responses, requests } = createInterceptors(configuration);
    responses.forEach(interceptor => {
      client.interceptors.response.use(interceptor);
    });
    requests.forEach(interceptor => {
      client.interceptors.request.use(interceptor);
    });
  });
  return client;
}

// Helpers

function isFunctionMatcher(matcher: Matcher): matcher is ResponseMatcherFunction | RequestMatcherFunction {
  return matcher instanceof Function;
}
function isRegExpMatcher(matcher: Matcher): matcher is RegExp {
  return matcher instanceof RegExp;
}
function isStringMatcher(matcher: Matcher): matcher is string {
  return typeof matcher === 'string';
}
