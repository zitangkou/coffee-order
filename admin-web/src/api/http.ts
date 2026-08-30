const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
  ) {
    super(message);
  }
}

export async function http<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("admin_token");
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("网络连接失败，请检查服务状态", 0);
  }

  const payload = (await response.json().catch(() => null)) as {
    code: number;
    data: T;
    msg: string;
  } | null;
  if (!response.ok || !payload || payload.code !== 0) {
    if (response.status === 401)
      window.dispatchEvent(new Event("admin:unauthorized"));
    if (response.status === 403 && payload?.msg?.includes("必须先修改密码")) {
      window.dispatchEvent(new Event("admin:password-required"));
    }
    throw new ApiError(
      payload?.msg || `请求失败（${response.status}）`,
      response.status,
      payload?.code,
    );
  }
  return payload.data;
}
