"""Modelos Pydantic: validan lo que entra y sale de la API."""
from pydantic import BaseModel, Field


class PeticionGuion(BaseModel):
    asaltos: int = Field(3, ge=1, le=20)
    duracion_asalto: int = Field(180, ge=20, le=600)
    descanso: int = Field(60, ge=0, le=300)
    nivel: int = Field(1, ge=1, le=3)
    zurdo: bool = False
    modo_reaccion: bool = False
    pausa: float | None = Field(None, ge=0, le=30)


class ComboDictado(BaseModel):
    asalto: int
    texto: str
    ids: list[str]


class SesionNueva(BaseModel):
    fecha: str | None = None  # ISO 8601; si falta, la pone el servidor
    asaltos: int = Field(ge=0)
    nivel: int = Field(ge=1, le=3)
    zurdo: bool = False
    duracion_asalto: int
    descanso: int
    combinaciones: list[ComboDictado]
