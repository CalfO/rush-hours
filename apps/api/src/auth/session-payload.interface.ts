import { Role } from "@prisma/client";

export interface SessionPayload {
  sub: string;
  username: string;
  role: Role;
}
