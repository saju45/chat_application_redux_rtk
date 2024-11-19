import { apiSlice } from "../api/apislice";

export const messagesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    //all endpoints here

    getMessages: builder.query({
      query: (id) =>
        `/messages?conversationId=${id}&_sort=timestamp&_order=desc&_page=1&_limit=${process.env.REACT_APP_MESSAGES_PER_PAG}`,
    }),
  }),
});

export const { useGetMessagesQuery } = messagesApi;
