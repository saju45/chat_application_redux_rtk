import { apiSlice } from "../api/apislice";

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    //all endpoints here
    getUser: builder.query({
      query: (email) => `/users?email=${email}`,
    }),
  }),
});

export const { useGetUserQuery } = usersApi;
