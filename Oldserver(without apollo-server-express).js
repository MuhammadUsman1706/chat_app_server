//  add ---> "type": "module", <--- in the package.json file to import in JS format

import { ApolloServer } from "apollo-server";

// .js is reqd because of "type" : "module" in the package.json
import typeDefs from "./typeDefs.js";
import resolvers from "./resolvers.js";
import jwt from "jsonwebtoken";

////////////////////////////////////
// Create an instance of the server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    // This context will run before the request reaches it's respective resolver. It will be passed through this first!
    // JWT token is in the authorization header
    const { authorization } = req.headers;

    if (authorization) {
      // This is decryption of the userId we provided earlier, name "userId" has to be same!
      const { userId } = jwt.verify(authorization, process.env.JWT_SECRET);

      // Now whatever we return here, all resolvers has the acess to it through "context" parameter.
      return { userId };
    }
  },
});

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});

// Subscriptions do not work with normal apollo-server. You have to install apollo-server-express
