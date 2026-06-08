"""
🎮 Agente Especializado en Modelado 3D y Diseño Web
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Un agente conversacional con herramientas para:
- Analizar, convertir y optimizar modelos 3D
- Crear y gestionar proyectos web con Three.js
- Generar escenas 3D interactivas para navegador

Uso: python agent.py
"""

import os
import sys
from anthropic import Anthropic

from tools_3d import TOOLS_3D, TOOL_HANDLERS_3D
from tools_web import TOOLS_WEB, TOOL_HANDLERS_WEB


SYSTEM_PROMPT = """Eres un agente experto en modelado 3D y diseño web. Tu especialidad es:

## Modelado 3D
- Analizar modelos 3D (vértices, caras, dimensiones, formatos)
- Convertir entre formatos (FBX, OBJ, GLB, STL, PLY) — siempre recomiendas GLB para web
- Optimizar modelos pesados reduciendo polígonos
- Centrar pivotes y normalizar tamaños para que todos los modelos tengan escala uniforme
- Aconsejar sobre buenas prácticas de modelado para web (polycount, texturas, LOD)

## Diseño Web con 3D
- Crear escenas Three.js con modelos 3D
- Generar HTML/CSS/JS para portfolios, presentaciones y experiencias interactivas
- Configurar iluminación, materiales, animaciones y efectos (partículas, post-processing)
- Optimizar rendimiento WebGL
- Diseño responsive y accesible

## Personalidad
- Hablas en español
- Eres directo y práctico, vas al grano
- Cuando el usuario pide algo, usas tus herramientas para hacerlo, no solo explicas cómo
- Si detectas un modelo pesado, sugieres optimizarlo
- Si el formato no es ideal para web, sugieres convertir a GLB

## Directorio de trabajo
El proyecto está en: {work_dir}
Los modelos 3D están en: {work_dir}/models/
"""


def main():
    work_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    client = Anthropic()

    all_tools = TOOLS_3D + TOOLS_WEB
    all_handlers = {**TOOL_HANDLERS_3D, **TOOL_HANDLERS_WEB}

    system = SYSTEM_PROMPT.format(work_dir=work_dir)
    messages = []

    print("=" * 60)
    print("  Agente 3D & Web Design")
    print("  Escribe tu petición o 'salir' para terminar")
    print("=" * 60)
    print()

    while True:
        try:
            user_input = input(" Tu > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nHasta luego!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("salir", "exit", "quit", "q"):
            print("Hasta luego!")
            break

        messages.append({"role": "user", "content": user_input})

        # Agent loop
        while True:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=system,
                tools=all_tools,
                messages=messages
            )

            # Collect text output
            assistant_text = ""
            tool_uses = []

            for block in response.content:
                if block.type == "text":
                    assistant_text += block.text
                elif block.type == "tool_use":
                    tool_uses.append(block)

            # Show text response
            if assistant_text:
                print(f"\n Agent > {assistant_text}\n")

            # Append full assistant message
            messages.append({"role": "assistant", "content": response.content})

            # If no tool calls, we're done with this turn
            if response.stop_reason == "end_turn" or not tool_uses:
                break

            # Handle tool calls
            tool_results = []
            for tool_use in tool_uses:
                tool_name = tool_use.name
                tool_input = tool_use.input

                print(f"   [herramienta] {tool_name}({tool_input})")

                handler = all_handlers.get(tool_name)
                if handler:
                    result = handler(tool_input)
                else:
                    result = f'{{"error": "Herramienta desconocida: {tool_name}"}}'

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": result
                })

            messages.append({"role": "user", "content": tool_results})


if __name__ == "__main__":
    main()
