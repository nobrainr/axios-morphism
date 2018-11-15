import { morphism, Schema, StrictSchema } from 'morphism';
import { AxiosResponse, AxiosInstance, AxiosRequestConfig } from 'axios';
import * as urljoin from 'url-join';
import * as pathToRegexp from 'path-to-regexp';

type ResponseMatcherFunction = (response: AxiosResponse) => boolean;
type RequestMatcherFunction = (request: AxiosRequestConfig) => boolean;

interface ResponseMatcher {
  matcher: string | RegExp | ResponseMatcherFunction;
  schema: Schema<any> | StrictSchema<any>;
  dataSelector?: string;
}
interface RequestMatcher {
  matcher: string | RegExp | RequestMatcherFunction;
  schema: Schema<any> | StrictSchema<any>;
  dataSelector?: string;
}
export interface AxiosMorphismConfiguration {
  url: string;
  interceptors: {
    requests: RequestMatcher[];
    responses: ResponseMatcher[];
  };
}

export function combine(baseURL: string, ...configurations: AxiosMorphismConfiguration[]) {
  const initialValue: AxiosMorphismConfiguration = { url: baseURL, interceptors: { requests: [], responses: [] } };
  return configurations.reduce((rootConfiguration, configuration) => {
    const configurationsMatcherString = configuration.interceptors.responses
      .filter(c => typeof c.matcher === 'string')
      .map(config => ({ ...config, matcher: urljoin(configuration.url, (<string>config.matcher).replace(/\/$/, '')) }));

    const configurationsMatcherFunction = configuration.interceptors.responses.filter(
      c => c.matcher instanceof Function
    );

    rootConfiguration.interceptors.responses.push(...configurationsMatcherFunction, ...configurationsMatcherString);
    return rootConfiguration;
  }, initialValue);
}

function applyMorphism(matcherConfiguration: ResponseMatcher, response: AxiosResponse) {
  const { schema, dataSelector } = matcherConfiguration;
  if (dataSelector) {
    const data = response.data[dataSelector];
    response.data[dataSelector] = morphism(schema, data);
  } else {
    response.data = morphism(schema, response.data);
  }
  return response;
}

function createTransformer(baseUrl: string, matcherConfiguration: ResponseMatcher) {
  if (matcherConfiguration.matcher instanceof Function) {
    const matcherFunction = matcherConfiguration.matcher;
    return (response: AxiosResponse) => {
      const hasMatched = matcherFunction(response);
      if (hasMatched) {
        return applyMorphism(matcherConfiguration, response);
      }
      return response;
    };
  } else if (typeof matcherConfiguration.matcher === 'string') {
    const finalPath = urljoin(baseUrl, <string>matcherConfiguration.matcher);
    const regExp = pathToRegexp(finalPath);
    return (response: AxiosResponse) => {
      const url = response.config.url;
      if (url && regExp.test(url)) {
        return applyMorphism(matcherConfiguration, response);
      }
      return response;
    };
  } else if (matcherConfiguration.matcher instanceof RegExp) {
    const matcherRegExp = matcherConfiguration.matcher;
    return (response: AxiosResponse) => {
      const url = response.config.url;
      if (url && matcherRegExp.test(url)) {
        return applyMorphism(matcherConfiguration, response);
      }
      return response;
    };
  }
}
function createResponseInterceptor(baseUrl: string, matcherConfiguration: ResponseMatcher) {
  const transformer = createTransformer(baseUrl, matcherConfiguration);
  return (response: AxiosResponse) => {
    if (transformer) {
      return transformer(response);
    }
    return response;
  };
}

function createInterceptors(configuration: AxiosMorphismConfiguration) {
  const { url } = configuration;
  const { requests, responses } = configuration.interceptors;
  const responseInterceptors = responses.map(matcher => createResponseInterceptor(url, matcher));
  // const requestInterceptors = requests.map(() => {});
  return { responses: responseInterceptors };
}

export function apply(client: AxiosInstance, ...configurations: AxiosMorphismConfiguration[]) {
  configurations.forEach(configuration => {
    const { responses } = createInterceptors(configuration);
    responses.forEach(interceptor => {
      client.interceptors.response.use(interceptor);
    });
  });
  return client;
}
