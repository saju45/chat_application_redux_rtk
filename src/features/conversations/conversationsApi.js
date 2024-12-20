import io from "socket.io-client";
import { apiSlice } from "../api/apislice";
import { messagesApi } from "../messages/messagesApi";

export const conversationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    //all endpoints here
    getConversations: builder.query({
      query: (email) =>
        `/conversations?participants_like=${email}&_sort=timestamp&_order=desc&_page=1&_limit=${process.env.REACT_APP_CONVERSATIONS_PER_PAGE}`,

      transformResponse(apiResponse, meta) {
        const totalCount = meta.response.headers.get("x-total-count");

        return {
          data: apiResponse,
          totalCount,
        };
      },

      async onCacheEntryAdded(
        arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        // create socket
        const socket = io("http://localhost:9000", {
          reconnectionDelay: 1000,
          reconnection: true,
          reconnectionAttemps: 10,
          transports: ["websocket"],
          agent: false,
          upgrade: false,
          rejectUnauthorized: false,
        });

        try {
          await cacheDataLoaded;
          socket.on("conversation", (data) => {
            updateCachedData((draft) => {
              const conversation = draft.find((c) => c.id == data.data.id);

              if (conversation.id) {
                conversation.message = data.data.message;
                conversation.timestamp = data.data.timestamp;
              } else {
                //do nothing
              }
            });
          });
        } catch (error) {}
        await cacheEntryRemoved;
        socket.close();
      },
    }),
    getMoreConversations: builder.query({
      query: ({ email, page }) =>
        `/conversations?participants_like=${email}&_sort=timestamp&_order=desc&_page=${page}&_limit=${process.env.REACT_APP_CONVERSATIONS_PER_PAGE}`,

      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const conversations = await queryFulfilled;

          if (conversations?.data?.length > 0) {
            // update conversation caches pessimistically start
            dispatch(
              apiSlice.util.updateQueryData(
                "getConversations",
                arg.email,
                (draft) => {
                  return {
                    data: [...draft.data, ...conversations.data],
                    totalCount: draft.totalCount,
                  };
                }
              )
            );
            // update conversations caches pessimistically end
          }
        } catch (error) {}
      },
    }),
    getConversation: builder.query({
      query: ({ userEmail, participantEmail }) =>
        `/conversations?participants_like=${userEmail}-${participantEmail}&&participants_like=${participantEmail}-${userEmail}`,
    }),
    addConversation: builder.mutation({
      query: ({ sender, data }) => ({
        url: `/conversations`,
        method: "POST",
        body: data,
      }),
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        //optimistic cache update start

        const patchResult = dispatch(
          apiSlice.util.updateQueryData(
            "getConversations",
            arg.sender,
            (draft) => {
              draft.push(arg.data);
            }
          )
        );
        //optimistic cache update end

        try {
          const conversation = await queryFulfilled;

          if (conversation?.data?.id) {
            const senderUser = arg?.data?.users.find(
              (user) => user.email === arg.sender
            );

            const receiverUser = arg?.data?.users.find(
              (user) => user.email !== arg.sender
            );

            dispatch(
              messagesApi.endpoints.addMessage.initiate({
                conversationId: conversation.data.id,
                sender: senderUser,
                receiver: receiverUser,
                message: arg.data.message,
                timestamp: arg.data.timestamp,
              })
            );
          }
        } catch (error) {
          patchResult.undo();
        }
      },
    }),

    editConversation: builder.mutation({
      query: ({ id, sender, data }) => ({
        url: `/conversations/${id}`,
        method: "PATCH",
        body: data,
      }),

      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        //optimistic cache update start
        const patchResult1 = dispatch(
          apiSlice.util.updateQueryData(
            "getConversations",
            arg.sender,
            (draft) => {
              const drafConversation = draft.data.find((c) => c.id == arg.id);
              drafConversation.message = arg.data.message;
              drafConversation.timestamp = arg.data.timestamp;
            }
          )
        );
        //optimistic cache update end

        try {
          const conversation = await queryFulfilled;

          if (conversation?.data?.id) {
            const senderUser = arg?.data?.users.find(
              (user) => user.email === arg.sender
            );

            const receiverUser = arg?.data?.users.find(
              (user) => user.email !== arg.sender
            );
            const res = await dispatch(
              messagesApi.endpoints.addMessage.initiate({
                conversationId: conversation.data.id,
                sender: senderUser,
                receiver: receiverUser,
                message: arg.data.message,
                timestamp: arg.data.timestamp,
              })
            ).unwrap();

            console.log(res);

            // update messages caches pessimistically start
            dispatch(
              apiSlice.util.updateQueryData(
                "getMessages",
                res.conversationId.toString(),
                (draft) => {
                  draft.push(res);
                }
              )
            );
            // update messages caches pessimistically end
          }
        } catch (error) {
          patchResult1.undo();
        }
      },
    }),
  }),
});

export const {
  useGetConversationsQuery,
  useGetMoreConversationsQuery,
  useGetConversationQuery,
  useAddConversationMutation,
  useEditConversationMutation,
} = conversationsApi;
