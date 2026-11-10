export const ROLES = Object.freeze(['employee','manager']);

export function isNodeInScope(actor,node){
    if (typeof actor?.nodeId !== 'string' || !node) {
      return false;
    }

    return(
        actor.nodeId === node._id || 
        (
            Array.isArray(node.ancestors) &&
            node.ancestors.includes(actor.nodeId)
        )
    );
}

export function canRead(actor, targetRole, node){
    if(
        !ROLES.includes(actor?.role) ||
        !ROLES.includes(targetRole)
    ){
        return false;
    }

    return(
        isNodeInScope(actor,node) &&
        (actor.role === 'manager' || targetRole === 'employee')
    );
}

export function canManage(actor,node){
    return(
        actor?.role === 'manager' &&
        isNodeInScope(actor,node)
    );
}