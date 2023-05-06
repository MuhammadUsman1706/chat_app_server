import pc from "@prisma/client";
import {
  // ApolloError,
  AuthenticationError,
  ForbiddenError,
} from "apollo-server-express";
import bcrypt from "bcryptjs";
import { PubSub } from "graphql-subscriptions";
import jwt from "jsonwebtoken";

// console.log(process.env.JWT_SECRET);

const pubsub = new PubSub();

const prisma = new pc.PrismaClient();

const MESSAGE_ADDED = "MESSAGE_ADDED";

const resolvers = {
  Query: {
    users: async (_, args, context) => {
      // console.log(context.userId);
      if (!context.userId) throw new ForbiddenError("You must be logged in!");

      const users = await prisma.user.findMany({
        orderBy: {
          createdAt: "desc",
        },
        where: {
          id: {
            not: context.userId,
          },
        },
      });
      return users;
    },
    messagesByUser: async (_, { receiverId }, { userId }) => {
      if (!userId) throw new ForbiddenError("You must be logged in!");

      const messages = await prisma.message.findMany({
        where: {
          OR: [
            {
              senderId: userId,
              receiverId: receiverId,
            },
            {
              senderId: receiverId,
              receiverId: userId,
            },
          ],
        },
        orderBy: {
          createdAt: "asc",
        },
      });
      return messages;
    },
  },

  Mutation: {
    signupUser: async (_, { userNew }) => {
      // To check if user exists already, and check it with email since it is unique
      const user = await prisma.user.findUnique({
        where: { email: userNew.email },
      });

      if (user) {
        // throw new Error("User already exists with that email!");
        // or throw an apollo or authentication error
        throw new AuthenticationError("User already exists with that email!");
      }

      // Decrypt the password using bcryptjs
      const hashedPassword = await bcrypt.hash(userNew.password, 10);

      //                            vvName of database
      const newUser = await prisma.user.create({
        data: {
          ...userNew,
          password: hashedPassword,
        },
      });

      return newUser;
    },

    signinUser: async (_, { userSignin }) => {
      const user = await prisma.user.findUnique({
        where: { email: userSignin.email },
      });

      if (!user)
        throw new AuthenticationError("User doesn't exist with that email!");

      const doMatch = await bcrypt.compare(userSignin.password, user.password);

      if (!doMatch)
        throw new AuthenticationError("Email or password is incorrect!");

      // Here, we're using the user ID to create a unique token, actually encrypting the ID to generate a token.
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);

      return { token };
    },
    createMessage: async (_, { receiverId, text }, { userId }) => {
      if (!userId) throw new ForbiddenError("You must be logged in!");
      const message = await prisma.message.create({
        data: {
          text: text,
          receiverId: receiverId,
          senderId: userId,
        },
      });

      pubsub.publish(MESSAGE_ADDED, { messageAdded: message });

      return message;
    },
  },

  Subscription: {
    messageAdded: {
      // It "sits" in our application and listens for the message added event. When it gets fired it broadcasts the update to all of it's subscribers!
      subscribe: () => pubsub.asyncIterator(MESSAGE_ADDED),
      // We call this event whenever a message is created (in the mutations)
    },
  },
};

export default resolvers;
