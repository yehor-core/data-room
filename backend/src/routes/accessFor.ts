import { DataRoomAccess } from '../access/dataRoomAccess';
import { AuthenticatedRequest } from '../types';

/** Gives a route the access module bound to the request's user. */
export type AccessFor = (req: AuthenticatedRequest) => DataRoomAccess;
