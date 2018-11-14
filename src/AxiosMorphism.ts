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

function createResponseInterceptor(baseUrl: string, matcherConfiguration: ResponseMatcher) {
  return (response: AxiosResponse) => {
    if (typeof matcherConfiguration.matcher === 'string') {
      const finalPath = urljoin(baseUrl, <string>matcherConfiguration.matcher);
      const regExp = pathToRegexp(finalPath);
      const url = response.config.url;

      if (regExp.test(url)) {
        const { schema, dataSelector } = matcherConfiguration;
        if (dataSelector) {
          const data = response.data[matcherConfiguration.dataSelector];
          response.data[matcherConfiguration.dataSelector] = morphism(schema, data);
        } else {
          response.data = morphism(schema, response.data);
        }
      }
      return response;
    }
    if (matcherConfiguration.matcher instanceof Function) {
      const hasMatched = matcherConfiguration.matcher(response);
      if (hasMatched) {
        const { schema, dataSelector } = matcherConfiguration;
        if (dataSelector) {
          const data = response.data[matcherConfiguration.dataSelector];
          response.data[matcherConfiguration.dataSelector] = morphism(schema, data);
        } else {
          response.data = morphism(schema, response.data);
        }
      }
      return response;
    }
    if (matcherConfiguration.matcher instanceof RegExp) {
      const url = response.config.url;

      if (matcherConfiguration.matcher.test(url)) {
        const { schema, dataSelector } = matcherConfiguration;
        if (dataSelector) {
          const data = response.data[matcherConfiguration.dataSelector];
          response.data[matcherConfiguration.dataSelector] = morphism(schema, data);
        } else {
          response.data = morphism(schema, response.data);
        }
      }
      return response;
    }
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
