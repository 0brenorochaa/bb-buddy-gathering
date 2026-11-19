import { createServerFn } from "@tanstack/react-start";
import type { RsvpInput } from "@/lib/rsvp-model";

export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: RsvpInput) => data)
  .handler(async ({ data }) => {
    const { submitRegistration: submit } = await import("./rsvp.server");
    return submit(data);
  });

export const fetchOwn = createServerFn({ method: "POST" })
  .inputValidator((data: { code?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { lookupOwn } = await import("./rsvp.server");
    return lookupOwn(data);
  });

export const adminSession = createServerFn({ method: "GET" }).handler(async () => {
  const { currentAdmin } = await import("./rsvp.server");
  const admin = await currentAdmin();
  return { authenticated: Boolean(admin), username: admin?.username ?? "" };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => ({
    username: typeof data?.username === "string" ? data.username : "",
    password: typeof data?.password === "string" ? data.password : "",
  }))
  .handler(async ({ data }) => {
    const { loginAdmin } = await import("./rsvp.server");
    return loginAdmin(data.username, data.password);
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutAdmin } = await import("./rsvp.server");
  return logoutAdmin();
});

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator((data: { currentPassword: string; nextPassword: string }) => ({
    currentPassword: typeof data?.currentPassword === "string" ? data.currentPassword : "",
    nextPassword: typeof data?.nextPassword === "string" ? data.nextPassword : "",
  }))
  .handler(async ({ data }) => {
    const { changeAdminPassword } = await import("./rsvp.server");
    return changeAdminPassword(data.currentPassword, data.nextPassword);
  });

export const loadDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { adminOverview } = await import("./rsvp.server");
  return adminOverview();
});

export const updateRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: RsvpInput & { id: string }) => data)
  .handler(async ({ data }) => {
    const { adminUpdate } = await import("./rsvp.server");
    return adminUpdate(data);
  });

export const deleteRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({
    id: typeof data?.id === "string" ? data.id : "",
  }))
  .handler(async ({ data }) => {
    const { adminRemove } = await import("./rsvp.server");
    return adminRemove(data);
  });
