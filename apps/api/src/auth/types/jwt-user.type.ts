import { Role } from "../../generated/prisma/enums";

export interface AuthenticatedUser {
  userId: string;
  role: Role;
}