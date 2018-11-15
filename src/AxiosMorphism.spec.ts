import { combine, AxiosMorphismConfiguration, apply } from './AxiosMorphism';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { StrictSchema } from 'morphism';

interface People {
  name: string;
  height: string;
  mass: string;
}
interface Planet {
  name: string;
  climate: string;
}
interface Starship {
  name: string;
  model: string;
  length: string;
}
describe('Axios Morphism', () => {
  describe('Combine', () => {
    it('should return a Root Configuration after using combine', () => {
      const baseURL = 'http://api.com';
      const expected: AxiosMorphismConfiguration = {
        url: baseURL,
        interceptors: {
          requests: [],
          responses: []
        }
      };
      expect(combine(baseURL)).toEqual(expected);
    });
    it('should combine multiple configurations', () => {
      const subset1: AxiosMorphismConfiguration = {
        url: '/people',
        interceptors: {
          requests: [],
          responses: [
            { matcher: '/', schema: { name: 'name', url: 'url' }, dataSelector: 'results' },
            { matcher: '/:id', schema: { name: 'name', url: 'url' }, dataSelector: 'results' }
          ]
        }
      };
      const subset2: AxiosMorphismConfiguration = {
        url: '/planets',
        interceptors: {
          requests: [],
          responses: [
            { matcher: '/', schema: { name: 'name', url: 'url' }, dataSelector: 'results' },
            { matcher: '/:id', schema: { name: 'name', url: 'url' }, dataSelector: 'results' }
          ]
        }
      };

      const expected: AxiosMorphismConfiguration = {
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

      expect(combine('https://swapi.co/api', subset1, subset2)).toEqual(expected);
    });
  });
  describe('Apply', () => {
    const mockPeople = {
      name: 'Luke Skywalker',
      height: '172',
      mass: '77',
      hair_color: 'blond',
      skin_color: 'fair'
    };
    const mockPlanet = {
      name: 'Tatooine',
      climate: 'arid',
      rotation_period: '23',
      orbital_period: '304'
    };
    const mockStarship = {
      name: 'Death Star',
      model: 'DS-1 Orbital Battle Station',
      manufacturer: 'Imperial Department of Military Research, Sienar Fleet Systems',
      cost_in_credits: '1000000000000',
      length: '120000'
    };
    const expectedPeople: People = {
      name: 'Luke Skywalker',
      height: '172',
      mass: '77'
    };
    const expectedPlanet: Planet = {
      name: 'Tatooine',
      climate: 'arid'
    };
    const expectedStarship: Starship = {
      name: 'Death Star',
      model: 'DS-1 Orbital Battle Station',
      length: '120000'
    };

    const peopleSchema: StrictSchema<People> = { name: 'name', height: 'height', mass: 'mass' };
    const planetSchema: StrictSchema<Planet> = { name: 'name', climate: 'climate' };
    const starshipSchema: StrictSchema<Starship> = { name: 'name', model: 'model', length: 'length' };

    describe('String Matchers', () => {
      let client: AxiosInstance;
      let mock: MockAdapter;
      const baseURL = 'https://swapi.co/api';
      beforeEach(() => {
        client = axios.create();
        mock = new MockAdapter(client);

        // People API
        mock.onGet(`${baseURL}/people`).reply(200, { results: [mockPeople] });
        mock.onGet(`${baseURL}/people/id`).reply(200, mockPeople);
        mock.onGet(`${baseURL}/people/id/starships/id`).reply(200, mockStarship);

        //Planets API
        mock.onGet(`${baseURL}/planets`).reply(200, { results: [mockPlanet] });
        mock.onGet(`${baseURL}/planets/id`).reply(200, mockPlanet);

        // Starships API
        mock.onGet(`${baseURL}/starships`).reply(200, { results: [mockStarship] });
        mock.onGet(`${baseURL}/starships/id`).reply(200, mockStarship);
      });
      afterEach(() => {
        mock.reset();
      });

      it('should apply request interceptors on string matcher', async () => {
        // Mock
        const onPostSpy = jasmine.createSpy(`Post on ${baseURL}/people/id}`);
        mock.onPost(`${baseURL}/people/id`).reply(config => {
          onPostSpy(JSON.parse(config.data));
          return [200];
        });
        // Config
        const expectedPerson = {
          name: mockPeople.name
        };
        const peopleToApiSchema = {
          name: 'name'
        };

        const config: AxiosMorphismConfiguration = {
          url: baseURL,
          interceptors: {
            requests: [{ matcher: '/people/:id', schema: peopleToApiSchema }],
            responses: []
          }
        };
        apply(client, config);

        await client.post(`${baseURL}/people/id`, mockPeople);
        expect(onPostSpy).toHaveBeenCalledWith(expectedPerson);
      });

      it('should apply response interceptors on flat urls (e.g /people, /planets) and use dataSelector when present to access axios data', async () => {
        const config: AxiosMorphismConfiguration = {
          url: baseURL,
          interceptors: {
            requests: [],
            responses: [
              { matcher: '/people', schema: peopleSchema, dataSelector: 'results' },
              { matcher: '/people/:id', schema: peopleSchema },
              { matcher: '/planets', schema: planetSchema, dataSelector: 'results' }
            ]
          }
        };
        apply(client, config);

        const planets = await client.get(`${baseURL}/planets`);
        const people = await client.get(`${baseURL}/people`);
        expect(planets.data.results).toEqual([expectedPlanet]);
        expect(people.data.results).toEqual([expectedPeople]);
      });

      it('should apply response interceptors on nested urls (e.g /people/:id)', async () => {
        const config: AxiosMorphismConfiguration = {
          url: baseURL,
          interceptors: {
            requests: [],
            responses: [
              { matcher: '/people', schema: peopleSchema, dataSelector: 'results' },
              { matcher: '/people/:id', schema: peopleSchema }
            ]
          }
        };
        apply(client, config);

        const people = await client.get(`${baseURL}/people`);
        const aPerson = await client.get(`${baseURL}/people/id`);
        expect(people.data.results).toEqual([expectedPeople]);
        expect(aPerson.data).toEqual(expectedPeople);
      });

      it('should apply response interceptors on deeply nested urls (e.g /people/:id/starships/:id)', async () => {
        const config: AxiosMorphismConfiguration = {
          url: baseURL,
          interceptors: {
            requests: [],
            responses: [
              { matcher: '/people/:id', schema: peopleSchema },
              { matcher: '/people/:id/starships/:id', schema: starshipSchema }
            ]
          }
        };
        apply(client, config);

        const aPerson = await client.get(`${baseURL}/people/id`);
        const aStarship = await client.get(`${baseURL}/people/id/starships/id`);

        expect(aPerson.data).toEqual(expectedPeople);
        expect(aStarship.data).toEqual(expectedStarship);
      });

      it('should apply response interceptors on combined morphisms', async () => {
        const peopleMorphism: AxiosMorphismConfiguration = {
          url: '/people',
          interceptors: {
            requests: [],
            responses: [
              { matcher: '/', schema: peopleSchema, dataSelector: 'results' },
              { matcher: '/:id', schema: peopleSchema },
              { matcher: /starships/, schema: starshipSchema }
            ]
          }
        };
        const planetMorphism: AxiosMorphismConfiguration = {
          url: '/planets',
          interceptors: {
            requests: [],
            responses: [
              { matcher: '/', schema: planetSchema, dataSelector: 'results' },
              { matcher: '/:id', schema: planetSchema }
            ]
          }
        };
        apply(client, combine(baseURL, peopleMorphism, planetMorphism));

        const aPerson = await client.get(`${baseURL}/people/id`);
        const aPlanet = await client.get(`${baseURL}/planets/id`);
        const aStarship = await client.get(`${baseURL}/people/id/starships/id`);

        expect(aPerson.data).toEqual(expectedPeople);
        expect(aPlanet.data).toEqual(expectedPlanet);
        expect(aStarship.data).toEqual(expectedStarship);
      });
    });

    describe('Function Matchers', () => {
      let client: AxiosInstance;
      let mock: MockAdapter;
      const baseURL = 'https://graphql.com/api';
      beforeEach(() => {
        client = axios.create();
        mock = new MockAdapter(client);

        // Simulate GraphQL API Behaviour
        mock.onPost(`${baseURL}`).reply(config => {
          const data = JSON.parse(config.data);
          switch (data.Operation) {
            case 'people': {
              return [200, { Operation: 'people', data: mockPeople }];
            }
            case 'planets': {
              return [200, { Operation: 'planets', data: mockPlanet }];
            }
            default:
              return [200, {}];
          }
        });
      });
      afterEach(() => {
        mock.reset();
      });
      it('should apply response interceptors on function matcher', async () => {
        const axiosMorphism: AxiosMorphismConfiguration = {
          url: '/',
          interceptors: {
            requests: [],
            responses: [
              {
                matcher: response => response.data.Operation === 'people',
                schema: peopleSchema,
                dataSelector: 'data'
              },
              {
                matcher: response => response.data.Operation === 'planets',
                schema: planetSchema,
                dataSelector: 'data'
              }
            ]
          }
        };

        apply(client, axiosMorphism);

        const aPerson = await client.post(`${baseURL}`, { Operation: 'people' });
        expect(aPerson.data.data).toEqual(expectedPeople);
        const aPlanet = await client.post(`${baseURL}`, { Operation: 'planets' });
        expect(aPlanet.data.data).toEqual(expectedPlanet);
      });
      it('should apply request interceptors on function matcher', async () => {
        const onPostSpy = jasmine.createSpy(`Post on ${baseURL}/people/id}`);
        mock.onPost(`${baseURL}/people/id`).reply(config => {
          onPostSpy(JSON.parse(config.data));
          return [200];
        });
        // Config
        const expectedPerson = {
          name: mockPeople.name
        };
        const peopleToApiSchema = {
          name: 'name'
        };

        const config: AxiosMorphismConfiguration = {
          url: baseURL,
          interceptors: {
            requests: [{ matcher: request => request.data === mockPeople, schema: peopleToApiSchema }],
            responses: []
          }
        };
        apply(client, config);

        await client.post(`${baseURL}/people/id`, mockPeople);
        expect(onPostSpy).toHaveBeenCalledWith(expectedPerson);
      });
      it('should apply interceptors on combined function matcher', async () => {
        const peopleMorphism: AxiosMorphismConfiguration = {
          url: '/',
          interceptors: {
            requests: [],
            responses: [
              {
                matcher: response => response.data.Operation === 'people',
                schema: peopleSchema,
                dataSelector: 'data'
              }
            ]
          }
        };

        const planetMorphism: AxiosMorphismConfiguration = {
          url: '/',
          interceptors: {
            requests: [],
            responses: [
              {
                matcher: response => response.data.Operation === 'planets',
                schema: planetSchema,
                dataSelector: 'data'
              }
            ]
          }
        };

        apply(client, combine(baseURL, peopleMorphism, planetMorphism));

        const aPerson = await client.post(`${baseURL}`, { Operation: 'people' });
        expect(aPerson.data.data).toEqual(expectedPeople);
        const aPlanet = await client.post(`${baseURL}`, { Operation: 'planets' });
        expect(aPlanet.data.data).toEqual(expectedPlanet);
      });
    });

    describe('RegExp Matchers', () => {
      let client: AxiosInstance;
      let mock: MockAdapter;
      const baseURL = 'https://swapi.co/api';
      beforeEach(() => {
        client = axios.create();
        mock = new MockAdapter(client);

        // People API
        mock.onGet(`${baseURL}/people`).reply(200, mockPeople);

        //Planets API
        mock.onGet(`${baseURL}/planets`).reply(200, mockPlanet);
      });
      afterEach(() => {
        mock.reset();
      });
      it('should apply response interceptors on regexp matcher', async () => {
        const axiosMorphism: AxiosMorphismConfiguration = {
          url: '/',
          interceptors: {
            requests: [],
            responses: [
              {
                matcher: /people$/,
                schema: peopleSchema
              },
              {
                matcher: /planets$/,
                schema: planetSchema
              }
            ]
          }
        };

        apply(client, axiosMorphism);

        const aPerson = await client.get(`${baseURL}/people`);
        expect(aPerson.data).toEqual(expectedPeople);
        const aPlanet = await client.get(`${baseURL}/planets`);
        expect(aPlanet.data).toEqual(expectedPlanet);
      });

      it('should apply request interceptors on regexp matcher', async () => {
        // Mock
        const onPostSpy = jasmine.createSpy(`Post on ${baseURL}/people/id}`);
        mock.onPost(`${baseURL}/people/id`).reply(config => {
          onPostSpy(JSON.parse(config.data));
          return [200];
        });
        // Config
        const expectedPerson = {
          name: mockPeople.name
        };
        const peopleToApiSchema = {
          name: 'name'
        };

        const config: AxiosMorphismConfiguration = {
          url: baseURL,
          interceptors: {
            requests: [{ matcher: /people\/id$/, schema: peopleToApiSchema }],
            responses: []
          }
        };
        apply(client, config);

        await client.post(`${baseURL}/people/id`, mockPeople);
        expect(onPostSpy).toHaveBeenCalledWith(expectedPerson);
      });
    });
  });
});
