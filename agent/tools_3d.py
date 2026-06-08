"""
Herramientas de procesamiento 3D para el agente especializado.
Usa trimesh para analizar, convertir y optimizar modelos 3D.
"""

import os
import json
import trimesh
import numpy as np


def analyze_model(file_path: str) -> str:
    """Analiza un modelo 3D y devuelve información detallada."""
    if not os.path.exists(file_path):
        return json.dumps({"error": f"Archivo no encontrado: {file_path}"})

    try:
        scene = trimesh.load(file_path)

        if isinstance(scene, trimesh.Scene):
            geometries = list(scene.geometry.values())
            total_vertices = sum(len(g.vertices) for g in geometries)
            total_faces = sum(len(g.faces) for g in geometries)
            bounds = scene.bounds
            extents = scene.extents
            mesh_names = list(scene.geometry.keys())
        elif isinstance(scene, trimesh.Trimesh):
            total_vertices = len(scene.vertices)
            total_faces = len(scene.faces)
            bounds = scene.bounds
            extents = scene.extents
            mesh_names = ["main_mesh"]
            geometries = [scene]
        else:
            return json.dumps({"error": "Formato no soportado o archivo vacío"})

        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)

        info = {
            "archivo": os.path.basename(file_path),
            "tamaño_archivo_mb": round(file_size_mb, 2),
            "vertices_total": total_vertices,
            "caras_total": total_faces,
            "num_meshes": len(geometries),
            "nombres_meshes": mesh_names[:10],
            "dimensiones": {
                "ancho": round(float(extents[0]), 3),
                "alto": round(float(extents[1]), 3),
                "profundidad": round(float(extents[2]), 3)
            },
            "bounds_min": [round(float(v), 3) for v in bounds[0]],
            "bounds_max": [round(float(v), 3) for v in bounds[1]],
            "centro": [round(float(v), 3) for v in ((bounds[0] + bounds[1]) / 2)],
            "es_watertight": all(g.is_watertight for g in geometries) if geometries else False
        }
        return json.dumps(info, indent=2, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": f"Error analizando modelo: {str(e)}"})


def convert_model(input_path: str, output_format: str) -> str:
    """Convierte un modelo 3D a otro formato (glb, obj, stl, ply)."""
    if not os.path.exists(input_path):
        return json.dumps({"error": f"Archivo no encontrado: {input_path}"})

    supported = ["glb", "gltf", "obj", "stl", "ply"]
    output_format = output_format.lower().strip(".")
    if output_format not in supported:
        return json.dumps({"error": f"Formato no soportado. Usa: {supported}"})

    try:
        scene = trimesh.load(input_path)
        base = os.path.splitext(input_path)[0]
        output_path = f"{base}.{output_format}"

        if output_format == "glb":
            if isinstance(scene, trimesh.Scene):
                data = scene.export(file_type="glb")
            else:
                data = scene.export(file_type="glb")
            with open(output_path, "wb") as f:
                f.write(data)
        else:
            scene.export(output_path)

        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        return json.dumps({
            "éxito": True,
            "archivo_salida": output_path,
            "tamaño_mb": round(size_mb, 2),
            "formato": output_format
        }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": f"Error convirtiendo: {str(e)}"})


def optimize_model(file_path: str, target_faces: int = None, ratio: float = 0.5) -> str:
    """Reduce la complejidad de un modelo 3D (decimation)."""
    if not os.path.exists(file_path):
        return json.dumps({"error": f"Archivo no encontrado: {file_path}"})

    try:
        mesh = trimesh.load(file_path, force="mesh")

        original_faces = len(mesh.faces)
        original_vertices = len(mesh.vertices)

        if target_faces is None:
            target_faces = int(original_faces * ratio)

        target_faces = max(target_faces, 100)

        simplified = mesh.simplify_quadric_decimation(target_faces)

        base, ext = os.path.splitext(file_path)
        output_path = f"{base}_optimized{ext}"
        simplified.export(output_path)

        return json.dumps({
            "éxito": True,
            "archivo_salida": output_path,
            "original": {"vertices": original_vertices, "caras": original_faces},
            "optimizado": {"vertices": len(simplified.vertices), "caras": len(simplified.faces)},
            "reducción": f"{(1 - len(simplified.faces) / original_faces) * 100:.1f}%"
        }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": f"Error optimizando: {str(e)}"})


def list_models(directory: str) -> str:
    """Lista todos los modelos 3D en un directorio."""
    if not os.path.exists(directory):
        return json.dumps({"error": f"Directorio no encontrado: {directory}"})

    extensions = {".fbx", ".obj", ".glb", ".gltf", ".stl", ".ply", ".dae", ".3ds", ".blend"}
    models = []

    for f in os.listdir(directory):
        ext = os.path.splitext(f)[1].lower()
        if ext in extensions:
            full_path = os.path.join(directory, f)
            size_mb = os.path.getsize(full_path) / (1024 * 1024)
            models.append({
                "nombre": f,
                "formato": ext[1:].upper(),
                "tamaño_mb": round(size_mb, 2),
                "ruta": full_path
            })

    models.sort(key=lambda x: x["nombre"])
    return json.dumps({"modelos": models, "total": len(models)}, indent=2, ensure_ascii=False)


def center_pivot(file_path: str) -> str:
    """Centra el pivote de un modelo en su centro geométrico y lo exporta."""
    if not os.path.exists(file_path):
        return json.dumps({"error": f"Archivo no encontrado: {file_path}"})

    try:
        mesh = trimesh.load(file_path, force="mesh")

        center = mesh.bounds.mean(axis=0)
        mesh.vertices -= center

        base, ext = os.path.splitext(file_path)
        output_path = f"{base}_centered{ext}"
        mesh.export(output_path)

        return json.dumps({
            "éxito": True,
            "archivo_salida": output_path,
            "centro_original": [round(float(v), 3) for v in center],
            "nuevo_centro": [0.0, 0.0, 0.0]
        }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": f"Error centrando pivote: {str(e)}"})


def normalize_size(file_path: str, target_height: float = 2.0) -> str:
    """Normaliza el tamaño de un modelo para que tenga una altura específica."""
    if not os.path.exists(file_path):
        return json.dumps({"error": f"Archivo no encontrado: {file_path}"})

    try:
        mesh = trimesh.load(file_path, force="mesh")

        extents = mesh.extents
        max_dim = max(extents)
        scale_factor = target_height / max_dim
        mesh.vertices *= scale_factor

        base, ext = os.path.splitext(file_path)
        output_path = f"{base}_normalized{ext}"
        mesh.export(output_path)

        return json.dumps({
            "éxito": True,
            "archivo_salida": output_path,
            "dimensiones_originales": [round(float(v), 3) for v in extents],
            "factor_escala": round(scale_factor, 6),
            "dimensiones_nuevas": [round(float(v * scale_factor), 3) for v in extents]
        }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": f"Error normalizando: {str(e)}"})


# Tool definitions for the agent
TOOLS_3D = [
    {
        "name": "analyze_model",
        "description": "Analiza un modelo 3D y devuelve info detallada: vértices, caras, dimensiones, bounds, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Ruta al archivo del modelo 3D"}
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "convert_model",
        "description": "Convierte un modelo 3D a otro formato (glb, obj, stl, ply). GLB es el más recomendado para web.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string", "description": "Ruta al modelo origen"},
                "output_format": {"type": "string", "description": "Formato de salida: glb, obj, stl, ply", "enum": ["glb", "obj", "stl", "ply"]}
            },
            "required": ["input_path", "output_format"]
        }
    },
    {
        "name": "optimize_model",
        "description": "Reduce la complejidad de un modelo 3D (decimation). Útil para optimizar modelos pesados para web.",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Ruta al modelo"},
                "target_faces": {"type": "integer", "description": "Número objetivo de caras (opcional)"},
                "ratio": {"type": "number", "description": "Ratio de reducción 0-1 (ej: 0.5 = 50% menos caras). Default: 0.5"}
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "list_models",
        "description": "Lista todos los modelos 3D en un directorio con su formato y tamaño.",
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {"type": "string", "description": "Ruta del directorio a escanear"}
            },
            "required": ["directory"]
        }
    },
    {
        "name": "center_pivot",
        "description": "Centra el pivote de un modelo en su centro geométrico. Útil cuando el modelo rota desde un punto desplazado.",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Ruta al modelo"}
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "normalize_size",
        "description": "Normaliza el tamaño de un modelo para que todos tengan la misma escala. Útil para escenas con múltiples modelos.",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Ruta al modelo"},
                "target_height": {"type": "number", "description": "Altura objetivo en unidades (default: 2.0)"}
            },
            "required": ["file_path"]
        }
    }
]

# Map tool names to functions
TOOL_HANDLERS_3D = {
    "analyze_model": lambda inp: analyze_model(inp["file_path"]),
    "convert_model": lambda inp: convert_model(inp["input_path"], inp["output_format"]),
    "optimize_model": lambda inp: optimize_model(inp["file_path"], inp.get("target_faces"), inp.get("ratio", 0.5)),
    "list_models": lambda inp: list_models(inp["directory"]),
    "center_pivot": lambda inp: center_pivot(inp["file_path"]),
    "normalize_size": lambda inp: normalize_size(inp["file_path"], inp.get("target_height", 2.0)),
}
