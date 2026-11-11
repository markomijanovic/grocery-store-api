import { Router } from 'express';
import { accessPolicy } from '../policies/access.policy.js';
import { validate } from '../http/middleware.js';
import { createUserSchema, updateUserSchema, userParamsSchema, nodeParamsSchema, listQuerySchema } from './users.schemas.js';

export function createUserRouter({ userService, authenticate }) {
  const router = Router();
  router.use(authenticate);
  for (const [path, role] of [['employees','employee'],['managers','manager']]) {
    const action = operation => (req, res, next) => {
      // Reject forbidden actions before looking up or validating the target resource.
      accessPolicy.assertAction(req.user, operation, role); next();
    };
    router.post(`/${path}`, action('manage'), validate(createUserSchema, 'body'), async (req, res) => {
      const user = await userService.create(req.user, role, req.validated.body);
      res.location(`/api/v1/${path}/${user.id}`).status(201).json(user);
    });
    router.get(`/${path}/:id`, action('read'), validate(userParamsSchema, 'params'), async (req, res) => {
      res.json(await userService.get(req.user, role, req.validated.params.id));
    });
    router.patch(`/${path}/:id`, action('manage'), validate(userParamsSchema, 'params'),
      validate(updateUserSchema, 'body'), async (req, res) => {
        res.json(await userService.update(req.user, role, req.validated.params.id, req.validated.body));
      });
    router.delete(`/${path}/:id`, action('manage'), validate(userParamsSchema, 'params'), async (req, res) => {
      await userService.delete(req.user, role, req.validated.params.id);
      res.status(204).end();
    });
    router.get(`/nodes/:nodeId/${path}`, action('read'), validate(nodeParamsSchema, 'params'),
      validate(listQuerySchema, 'query'), async (req, res) => {
        res.json(await userService.list(req.user, role, req.validated.params.nodeId, req.validated.query));
      });
  }
  return router;
}
