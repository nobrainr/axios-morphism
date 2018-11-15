# axios-morphism

## Getting started

### Installation

```sh

npm install --save axios-morphism

```

### Example

```typescript
import { apply, AxiosMorphismConfiguration } from './axios-morphism';

const peopleSchema = { name: 'name', firstName: 'firstName' };

const configuration: AxiosMorphismConfiguration = {
  url: 'https://api.com',
  interceptors: {
    responses: [{ matcher: '/people/:id', schema: peopleSchema }]
  }
};

apply(client, configuration);
await client.get(`https://api.com/people/1`);

▶
// {
//   name: 'Smith',
//   firstName: 'John'
// }
```

## License

MIT © [Yann Renaudin][twitter-account]

[twitter-account]: https://twitter.com/renaudin_yann
