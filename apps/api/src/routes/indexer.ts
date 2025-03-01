import { Router, Request, Response } from 'express';
import { indexDocsHandler } from '../handlers/indexDocsHandler';

export const indexerRouter = Router();

indexerRouter.post('/', (req: Request, res: Response) => {
  indexDocsHandler(req, res);
});
