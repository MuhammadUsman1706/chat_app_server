// With apollo-server-express
import { ApolloServer } from "apollo-server-express";
import typeDefs from "./typeDefs.js";
import resolvers from "./resolvers.js";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import express from "express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";

// To create the schema
import { makeExecutableSchema } from "@graphql-tools/schema";

// Heroku will define the port by itself
const port = process.env.PORT || 4000;

// create express and HTTP server
const app = express();

const context = ({ req }) => {
  const { authorization } = req.headers;
  if (authorization) {
    const { userId } = jwt.verify(authorization, process.env.JWT_SECRET);
    return { userId };
  }
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const httpServer = createServer(app);

// create websocket server
const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});

// Save the returned server's info so we can shut down this server later
const serverCleanup = useServer({ schema }, wsServer);

// create apollo server
const apolloServer = new ApolloServer({
  schema,
  context,
  plugins: [
    // Proper shutdown for the HTTP server.
    ApolloServerPluginDrainHttpServer({ httpServer }),

    // Proper shutdown for the WebSocket server.
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await apolloServer.start();

// Access your server with the link you have described below, ---> "http://localhost:4000/graphql" <--- here
apolloServer.applyMiddleware({ app, path: "/graphql" });

httpServer.listen(port);

console.log("Apollo and subscription server is up!");

// const server = new ApolloServer({
//   typeDefs,
//   resolvers,
//   context: ({ req }) => {
//     const { authorization } = req.headers;
//     if (authorization) {
//       const { userId } = jwt.verify(authorization, process.env.JWT_SECRET);
//       return { userId };
//     }
//   },
// });

// server.listen().then(({ url }) => {
//   console.log(`🚀  Server ready at ${url}`);
// });

// Export the Express API
module.exports = app;
