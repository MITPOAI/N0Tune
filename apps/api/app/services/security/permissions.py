"""Role-based permissions for the N0Tune API.

This is a deliberately small RBAC system. Four roles in a strict order
(``viewer`` < ``developer`` < ``admin`` < ``owner``). Each permission has a
minimum role; any role at or above the minimum is allowed. The point is to
keep the rule set obvious — there is no per-resource ACL.

Legacy auth (the single ``N0TUNE_APP_API_KEY``) is treated as ``owner`` so
existing setups keep working. Multi-key fan-out lives in
``services/security/api_keys.py``.
"""

from __future__ import annotations

from enum import Enum

from fastapi import HTTPException, status


class Role(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    DEVELOPER = "developer"
    VIEWER = "viewer"


_ORDER = [Role.VIEWER, Role.DEVELOPER, Role.ADMIN, Role.OWNER]
_RANK = {role: index for index, role in enumerate(_ORDER)}


class Permission(str, Enum):
    READ_MEMORY = "memory.read"
    WRITE_MEMORY = "memory.write"
    DELETE_MEMORY = "memory.delete"
    READ_DOCUMENT = "document.read"
    WRITE_DOCUMENT = "document.write"
    DELETE_DOCUMENT = "document.delete"
    VIEW_CONTEXT_TRACE = "context.read"
    MANAGE_API_KEYS = "api_keys.manage"
    VIEW_AUDIT_LOGS = "audit_logs.read"


PERMISSION_MIN_ROLE: dict[Permission, Role] = {
    Permission.READ_MEMORY: Role.VIEWER,
    Permission.WRITE_MEMORY: Role.DEVELOPER,
    Permission.DELETE_MEMORY: Role.ADMIN,
    Permission.READ_DOCUMENT: Role.VIEWER,
    Permission.WRITE_DOCUMENT: Role.DEVELOPER,
    Permission.DELETE_DOCUMENT: Role.ADMIN,
    Permission.VIEW_CONTEXT_TRACE: Role.VIEWER,
    Permission.MANAGE_API_KEYS: Role.OWNER,
    Permission.VIEW_AUDIT_LOGS: Role.ADMIN,
}


def role_satisfies(role: Role | str | None, minimum: Role) -> bool:
    if role is None:
        return False
    try:
        actor = role if isinstance(role, Role) else Role(role)
    except ValueError:
        return False
    return _RANK[actor] >= _RANK[minimum]


def require_permission(role: Role | str | None, permission: Permission) -> None:
    minimum = PERMISSION_MIN_ROLE[permission]
    if not role_satisfies(role, minimum):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Insufficient role for this operation.",
                "permission": permission.value,
                "required_role": minimum.value,
                "actor_role": role.value if isinstance(role, Role) else role,
            },
        )
