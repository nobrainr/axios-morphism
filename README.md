# axios-morphism
[![npm](https://img.shields.io/npm/v/axios-morphism.svg?style=for-the-badge)](https://www.npmjs.com/package/axios-morphism) [![npm bundle size (minified)](https://img.shields.io/bundlephobia/min/axios-morphism.svg?style=for-the-badge)](https://github.com/nobrainr/axios-morphism) [![Coveralls github](https://img.shields.io/coveralls/github/nobrainr/axios-morphism.svg?style=for-the-badge)](https://coveralls.io/github/nobrainr/axios-morphism?branch=master) [![CircleCI (all branches)](https://img.shields.io/circleci/project/github/nobrainr/axios-morphism/master.svg?style=for-the-badge)](https://circleci.com/gh/nobrainr/axios-morphism) [![Deps](https://img.shields.io/david/nobrainr/axios-morphism.svg?style=for-the-badge)](https://www.npmjs.com/package/axios-morphism)

> An Axios plugin to transform requests and response data on-the-fly based on a schema.

This package is built upon [`Morphism`](https://www.npmjs.com/package/morphism). Read the documentation [here](https://github.com/nobrainr/morphism).

---

- [axios-morphism](#axios-morphism)
  - [Getting started](#getting-started)
    - [Installation](#installation)
    - [Example](#example)
  - [Usage](#usage)
    - [Schema](#schema)
    - [Interceptors Configuration](#interceptors-configuration)
      - [Example:](#example)
      - [Axios-Morphism Configuration](#axios-morphism-configuration)
    - [Apply Configurations](#apply-configurations)
    - [Remove Configurations](#remove-configurations)
    - [Combine Configurations](#combine-configurations)
  - [License](#license)

## Getting started

### Installation

```sh
npm install --save axios # Axios is defined as a PeerDependency in axios-morphism
npm install --save axios-morphism
```

### Example

```typescript
import axios from 'axios';
import { apply, AxiosMorphismConfiguration } from 'axios-morphism';

const peopleSchema = {
  name: 'name',
  height: 'height',
  weight: 'mass'
};

const configuration: AxiosMorphismConfiguration = {
  url: 'https://swapi.co/api/',
  interceptors: {
    responses: [
      { matcher: '/people', schema: peopleSchema, dataSelector: 'results' },
      { matcher: '/people/:id', schema: peopleSchema }
      ],
    requests: []
  }
};

const client = axios.create({baseURL: 'https://swapi.co/api/'});
apply(client, configuration);

await client.get('/people/1');
▼
// {
//   name: "Luke Skywalker"
//   height: "172"
//   weight: "77"
// }

await client.get('/people');
▼
// [
//  {
//    name: "Luke Skywalker"
//    height: "172"
//    weight: "77"
//  },....
// ]
```

## Usage

### Schema

Define a schema corresponding to the shape you expect to have after the transformation has been applied.

▶ [Read About Morphism's Schema Capabilities](https://github.com/nobrainr/morphism#1-the-schema)

```typescript
const peopleSchema = {
  name: 'name',
  height: 'height',
  weight: ({ mass }) => `${mass} KG`
};
```

### Interceptors Configuration

Create your configurations to be applied on Axios requests or responses.

#### Example:

```typescript
const configuration: AxiosMorphismConfiguration = {
  url: 'https://swapi.co/api/',
  interceptors: {
    responses: [
      { matcher: '/people', schema: peopleSchema, dataSelector: 'results' },
      { matcher: /\/people\/([^\/]+?)(?:\/)?$/i, schema: peopleSchema }, // matches /people/:id
      {
        matcher: (response: AxiosResponse) => response.config.method === 'POST',  // matches every responses obtained using a POST
        schema: peopleSchema,
        dataSelector: 'results'
      }
    ],
    requests: []
  }
};
```

#### Axios-Morphism Configuration

| Property                                                                   | Type                              | Description                                                                         | Example                                                                                                          |
| -------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| url                                                                        | `string`                          | Base URL to listen on                                                               | `https://swapi.co/api`                                                                                           |
| interceptors                                                               | `{ responses: [], requests: []};` | List of Responses and Requests Interceptors Configuration to register against Axios |
| interceptors.responses[].matcher                                           | `string` `RegExp` `Function`      | Matcher used to detect on which response to apply the transformer                   | - `'people/:id'` <br> - `/people$/i` <br> - `(response: AxiosResponse) => response.config.method === 'POST'`     |
| interceptors.requests[].matcher                                            | `string` `RegExp` `Function`      | Matcher used to detect on which request to apply the transformer                    | - `'planets/:id'` <br> - `/planets$/i` <br> - `(request: AxiosRequestConfig) => request.url.includes('planets')` |
| interceptors.requests[].schema interceptors.responses[].schema             | `Schema` `StrictSchema`           | A schema is an object-preserving map from one data structure to another.            | [Morphism Schema Examples](https://github.com/nobrainr/morphism#schema-example)                                  |
| interceptors.requests[].dataSelector interceptors.responses[].dataSelector | `string`                          | A selector to access the data in the Axios returned data                            | With this Axios Response: `{ data: { results: [] }}`. Pick the data with `{ dataSelector: 'results' }`           |



### Apply Configurations

Apply your interceptors on your axios instance and there you go!

```typescript
import { apply } from 'axios-morphism';

const configuration: AxiosMorphismConfiguration = {
  url: 'https://swapi.co/api/',
  interceptors: {
    responses: [
      { matcher: '/people', schema: peopleSchema, dataSelector: 'results' },
      { matcher: /\/people\/([^\/]+?)(?:\/)?$/i, schema: peopleSchema } // Will match /people/:id
    ],
    requests: []
  }
};

const client = axios.create({ baseURL: 'https://swapi.co/api/' });
apply(client, configuration);

// Start making requests to see you data transformed
await client.get('/people');
await client.get('/people/1');
```

### Remove Configurations
Use the `unsubscribe` method returned from the `apply` function to opt-out from the interceptors

```typescript
const configuration: AxiosMorphismConfiguration = {...};

const axiosMorphism = apply(client, config);
axiosMorphism.unsubscribe(); // Remove all registered interceptors
```

### Combine Configurations

`axios-morphism` provides the `combine` function in order to help you merge multiple configurations under a `baseURL`.

```typescript
import { apply, combine, AxiosMorphismConfiguration } from 'axios-morphism';

const peopleMorphism: AxiosMorphismConfiguration = {
  url: '/people',
  interceptors: {
    requests: [],
    responses: [
      { matcher: '/', schema: { name: 'name', url: 'url' }, dataSelector: 'results' },
      { matcher: '/:id', schema: { name: 'name', url: 'url' }, dataSelector: 'results' }
    ]
  }
};
const planetMorphism: AxiosMorphismConfiguration = {
  url: '/planets',
  interceptors: {
    requests: [],
    responses: [
      { matcher: '/', schema: { name: 'name', url: 'url' }, dataSelector: 'results' },
      { matcher: '/:id', schema: { name: 'name', url: 'url' }, dataSelector: 'results' }
    ]
  }
};

const client = axios.create({ baseURL: 'https://swapi.co/api/' });
apply(client, combine('https://swapi.co/api/', peopleMorphism, planetMorphism));

// Start making requests to see you data transformed
await client.get('/people');
await client.get('/planets/1');
```

## License

MIT © [Yann Renaudin][twitter-account]

[twitter-account]: https://twitter.com/renaudin_yann
