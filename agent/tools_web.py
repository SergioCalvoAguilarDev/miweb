"""
Herramientas de diseño web para el agente especializado.
Genera código, gestiona archivos web y lanza servidores de desarrollo.
"""

import os
import json
import subprocess
import signal


_server_process = None


def read_file(file_path: str) -> str:
    """Lee el contenido de un archivo."""
    if not os.path.exists(file_path):
        return json.dumps({"error": f"Archivo no encontrado: {file_path}"})
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return json.dumps({
            "archivo": file_path,
            "contenido": content,
            "líneas": content.count("\n") + 1
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


def write_file(file_path: str, content: str) -> str:
    """Escribe contenido en un archivo (crea directorios si es necesario)."""
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return json.dumps({
            "éxito": True,
            "archivo": file_path,
            "bytes": len(content.encode("utf-8"))
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


def list_project_files(directory: str) -> str:
    """Lista los archivos de un proyecto web (HTML, CSS, JS, imágenes, modelos)."""
    if not os.path.exists(directory):
        return json.dumps({"error": f"Directorio no encontrado: {directory}"})

    web_exts = {".html", ".css", ".js", ".ts", ".jsx", ".tsx", ".json", ".svg",
                ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
                ".fbx", ".obj", ".glb", ".gltf", ".stl"}
    files = []

    for root, dirs, filenames in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "__pycache__"}]
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in web_exts:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, directory)
                size_kb = os.path.getsize(full) / 1024
                files.append({
                    "ruta": rel,
                    "tipo": ext[1:],
                    "tamaño_kb": round(size_kb, 1)
                })

    files.sort(key=lambda x: x["ruta"])
    return json.dumps({"archivos": files, "total": len(files)}, indent=2, ensure_ascii=False)


def start_dev_server(directory: str, port: int = 8080) -> str:
    """Lanza un servidor HTTP de desarrollo."""
    global _server_process
    try:
        if _server_process and _server_process.poll() is None:
            return json.dumps({"info": f"Servidor ya corriendo en puerto {port}"})

        _server_process = subprocess.Popen(
            ["python", "-m", "http.server", str(port)],
            cwd=directory,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return json.dumps({
            "éxito": True,
            "url": f"http://localhost:{port}",
            "directorio": directory,
            "pid": _server_process.pid
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


def stop_dev_server() -> str:
    """Detiene el servidor de desarrollo."""
    global _server_process
    if _server_process and _server_process.poll() is None:
        _server_process.terminate()
        _server_process.wait(timeout=5)
        _server_process = None
        return json.dumps({"éxito": True, "mensaje": "Servidor detenido"})
    return json.dumps({"info": "No hay servidor corriendo"})


def generate_threejs_scene(models: list, output_path: str, background_color: str = "#0a0b14") -> str:
    """Genera una escena Three.js con modelos 3D flotantes."""
    try:
        model_entries = ""
        for m in models:
            model_entries += f"    {{ file: '{m}', type: '{os.path.splitext(m)[1][1:].lower()}' }},\n"

        code = f"""import * as THREE from 'three';
import {{ FBXLoader }} from 'three/addons/loaders/FBXLoader.js';
import {{ OBJLoader }} from 'three/addons/loaders/OBJLoader.js';
import {{ GLTFLoader }} from 'three/addons/loaders/GLTFLoader.js';

// Auto-generated Three.js scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('{background_color}');

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer({{ antialias: true }});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 8, 5);
scene.add(dirLight);

// Models to load
const models = [
{model_entries}];

const loaders = {{
    fbx: new FBXLoader(),
    obj: new OBJLoader(),
    glb: new GLTFLoader(),
    gltf: new GLTFLoader()
}};

// Load and add models...
models.forEach(m => {{
    const loader = loaders[m.type];
    if (!loader) return;
    loader.load(m.file, (obj) => {{
        const model = m.type === 'glb' || m.type === 'gltf' ? obj.scene : obj;
        scene.add(model);
    }});
}});

function animate() {{
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}}
animate();

window.addEventListener('resize', () => {{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}});
"""
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(code)

        return json.dumps({
            "éxito": True,
            "archivo": output_path,
            "modelos_incluidos": len(models)
        }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": str(e)})


# Tool definitions for the agent
TOOLS_WEB = [
    {
        "name": "read_file",
        "description": "Lee el contenido de un archivo del proyecto web.",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Ruta al archivo"}
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "write_file",
        "description": "Escribe o crea un archivo en el proyecto (HTML, CSS, JS, etc).",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Ruta del archivo a escribir"},
                "content": {"type": "string", "description": "Contenido del archivo"}
            },
            "required": ["file_path", "content"]
        }
    },
    {
        "name": "list_project_files",
        "description": "Lista todos los archivos web y 3D de un directorio de proyecto.",
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {"type": "string", "description": "Ruta del directorio del proyecto"}
            },
            "required": ["directory"]
        }
    },
    {
        "name": "start_dev_server",
        "description": "Lanza un servidor HTTP local para previsualizar el proyecto web.",
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {"type": "string", "description": "Directorio raíz del proyecto"},
                "port": {"type": "integer", "description": "Puerto (default: 8080)"}
            },
            "required": ["directory"]
        }
    },
    {
        "name": "stop_dev_server",
        "description": "Detiene el servidor de desarrollo.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "generate_threejs_scene",
        "description": "Genera automáticamente un archivo JS con una escena Three.js que carga modelos 3D.",
        "input_schema": {
            "type": "object",
            "properties": {
                "models": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Lista de rutas a modelos 3D"
                },
                "output_path": {"type": "string", "description": "Ruta del archivo JS de salida"},
                "background_color": {"type": "string", "description": "Color de fondo hex (default: #0a0b14)"}
            },
            "required": ["models", "output_path"]
        }
    }
]

TOOL_HANDLERS_WEB = {
    "read_file": lambda inp: read_file(inp["file_path"]),
    "write_file": lambda inp: write_file(inp["file_path"], inp["content"]),
    "list_project_files": lambda inp: list_project_files(inp["directory"]),
    "start_dev_server": lambda inp: start_dev_server(inp["directory"], inp.get("port", 8080)),
    "stop_dev_server": lambda inp: stop_dev_server(),
    "generate_threejs_scene": lambda inp: generate_threejs_scene(
        inp["models"], inp["output_path"], inp.get("background_color", "#0a0b14")
    ),
}
