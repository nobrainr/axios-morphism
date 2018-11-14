import { combine, AxiosMorphismConfiguration } from './AxiosMorphism';
import axios, { AxiosResponse, AxiosInstance } from 'axios';

const URL = 'https://swapi.co/api';
const httpClient = axios.create({ baseURL: URL });

const swapiApi: AxiosMorphismConfiguration = {
  url: 'https://swapi.co/api',
  interceptors: {
    requests: [],
    responses: [
      { matcher: '/people', schema: { name: 'name', url: 'url' }, dataSelector: 'results' },
      { matcher: '/people/:id', schema: { name: 'name', url: 'url' }, dataSelector: 'results' },
      { matcher: '/planets', schema: { name: 'name', url: 'url' }, dataSelector: 'results' },
      { matcher: '/planets/:id', schema: { name: 'name', url: 'url' }, dataSelector: 'results' }
    ]
  }
};

const suSswapiApi: AxiosMorphismConfiguration = {
  url: '/people',
  interceptors: {
    requests: [],
    responses: [
      { matcher: '/', schema: { name: 'name', url: 'url' }, dataSelector: 'results' },
      { matcher: '/:id', schema: { name: 'name', url: 'url' }, dataSelector: 'results' }
    ]
  }
};
const subswapiApi: AxiosMorphismConfiguration = {
  url: '/planets',
  interceptors: {
    requests: [],
    responses: [
      { matcher: '/', schema: { name: 'name', url: 'url' }, dataSelector: 'results' },
      { matcher: '/:id', schema: { name: 'name', url: 'url' }, dataSelector: 'results' }
    ]
  }
};
const bigGraphQL: AxiosMorphismConfiguration = {
  url: '/',
  interceptors: {
    requests: [],
    responses: [
      {
        matcher: response =>
          response.config.method === 'POST' && (<string>response.config.data).includes('myOperationName'),
        schema: { name: 'name', url: 'url' }
      },
      {
        matcher: (response: AxiosResponse) =>
          response.config.method === 'POST' && (<string>response.config.data).includes('myOperationName'),
        schema: { name: 'name', url: 'url' }
      }
    ]
  }
};
const graphQLOP1: AxiosMorphismConfiguration = {
  url: '/',
  interceptors: {
    requests: [],
    responses: [
      {
        matcher: response =>
          response.config.method === 'POST' && (<string>response.config.data).includes('myOperationName'),
        schema: { name: 'name', url: 'url' }
      }
    ]
  }
};

const graphQLOP2: AxiosMorphismConfiguration = {
  url: '/',
  interceptors: {
    requests: [],
    responses: [
      {
        matcher: (response: AxiosResponse) =>
          response.config.method === 'POST' && (<string>response.config.data).includes('myOperationName'),
        schema: { name: 'name', url: 'url' }
      }
    ]
  }
};

// function apply(client: AxiosInstance, ...configurations: AxiosMorphismConfiguration[]) {
//   configurations.forEach(configuration => {
//     client.interceptors.response.use(configuration.interceptors.responses[0].success);
//   });
//   return client;
// }

// apply(httpClient, swapiApi);

// // axios-morphism

// function applyConfiguration(configuration, client) {
//   configuration.interceptors.response.forEach(interceptor => {
//     client.interceptors.response.use(interceptor.success);
//   });
//   return client;
// }
// applyConfiguration(internalAxiosMorphismConfiguration, httpClient);
// httpClient.interceptors.request.use();
// // axios-morphism

// async function getPeople() {
//   const response = await httpClient.get('/people');
//   return response.data ? response.data.results : null;
// }

// async function getPlanets() {
//   const response = await httpClient.get('/planets');
//   return response.data ? response.data.results : null;
// }

// getPeople().then(result => {
//   console.log('People', JSON.stringify(result, null, 2));
// });

// getPlanets().then(result => {
//   console.log('Planets', JSON.stringify(result, null, 2));
// });
