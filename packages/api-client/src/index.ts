import type { ApiResult } from "@messmate/types";
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function createApiClient(
  baseUrl: string,
  token?: () => Promise<string | null>,
) {
  return {
    async request<T>(
      path: string,
      options: { method?: string; body?: unknown } = {},
    ): Promise<T> {
      const session = token ? await token() : null;
      const response = await fetch(baseUrl + path, {
        method: options.method ?? "GET",
        credentials: token ? "omit" : "include",
        headers: {
          ...(token ? { "X-Messmate-Client": "mobile" } : {}),
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...(session ? { Authorization: `Bearer ${session}` } : {}),
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      let data: ApiResult<T>;
      try {
        data = (await response.json()) as ApiResult<T>;
      } catch {
        throw new ApiError(
          "NETWORK_ERROR",
          "The server returned an unreadable response.",
          response.status,
        );
      }
      if (!data.success)
        throw new ApiError(
          data.error.code,
          data.error.message,
          response.status,
        );
      return data.data;
    },
  };
}
