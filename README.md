# axios-morphism

## Getting started

### Installation

```sh
npm install --save axios
npm install --save axios-morphism
```

### Example

```typescript
import axios from "axios";
import { apply, AxiosMorphismConfiguration } from 'axios-morphism';

const peopleSchema = {
  name: 'name',
  height: 'height',
  weight: 'mass'
};

const configuration: AxiosMorphismConfiguration = {
  url: 'https://swapi.co/api/',
  interceptors: {
    responses: [{ matcher: '/people/:id', schema: peopleSchema }],
    requests: []
  }
};

const client = axios.create({baseURL: 'https://swapi.co/api/'});
apply(client, configuration);

await client.get('/people/1');
▶
// {
//   name: "Luke Skywalker"
//   height: "172"
//   weight: "77"
// }
```

## License

MIT © [Yann Renaudin][twitter-account]

[twitter-account]: https://twitter.com/renaudin_yann
