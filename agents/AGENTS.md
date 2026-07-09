# DEVELOPMENT_PHILOSOPHY.md

## Objetivo

Este documento define la filosofía de desarrollo que debe seguir el agente durante todo el ciclo de vida del proyecto.

El objetivo del agente **no es únicamente producir código funcional**, sino diseñar y mantener un sistema que sea:

- Fácil de entender.
- Fácil de mantener.
- Fácil de extender.
- Consistente.
- Escalable.

El agente debe actuar como **un arquitecto de software**, no únicamente como un programador.

---

# Principios Fundamentales

## 1. El MVP no significa código desechable

Un MVP busca validar funcionalidad rápidamente, **no justificar malas decisiones de arquitectura**.

El código del MVP debe poder evolucionar naturalmente hacia un sistema completo.

Se aceptan funcionalidades ocultas desde la interfaz si ayudan a evitar futuras migraciones del modelo de datos.

---

## 2. La arquitectura debe ir un paso adelante del producto

La arquitectura debe anticipar únicamente las necesidades razonablemente cercanas.

No debe diseñarse para todos los escenarios posibles.

No debe quedarse corta al punto de requerir migraciones constantes.

**Debe mantenerse aproximadamente un paso adelante del producto, nunca diez.**

---

## 3. Priorizar simplicidad

Cuando existan varias soluciones correctas, elegir la más simple.

Evitar:

- sobreingeniería,
- abstracciones innecesarias,
- patrones utilizados únicamente "por si algún día".

La complejidad solo debe introducirse cuando resuelva un problema real.

---

## 4. La evolución debe ser incremental

Cada versión debe ser una evolución natural de la anterior.

Las nuevas funcionalidades deben construirse sobre la arquitectura existente.

Evitar reescrituras completas salvo que exista una razón técnica muy fuerte.

---

# Filosofía Arquitectónica

## Separación de responsabilidades

Cada capa tiene una responsabilidad claramente definida.

Ejemplo:

```text
UI

↓

Servicios

↓

Repositorios

↓

Persistencia

↓

Base de datos
```

Las capas superiores nunca deben conocer detalles internos de las inferiores.

---

## Acoplamiento mínimo

El agente debe reducir el acoplamiento entre módulos.

Cuando una dependencia pueda aislarse mediante una interfaz o repositorio, debe preferirse esa solución.

---

## Cohesión alta

Cada módulo debe tener una única responsabilidad.

Si un archivo comienza a tener múltiples objetivos, debe dividirse.

---

## Arquitectura preparada para evolucionar

El sistema debe permitir reemplazar componentes importantes con el menor impacto posible.

Ejemplos:

- IndexedDB → PostgreSQL
- Dexie → API
- PWA → React Native
- Local → Sincronización remota

La lógica de negocio nunca debe depender directamente de la tecnología utilizada.

---

# Organización del Código

## Componentes

Los componentes deben ser pequeños.

Cada componente debe tener una única responsabilidad.

Evitar componentes excesivamente grandes.

---

## Servicios

Los servicios contienen reglas de negocio.

No deben contener lógica de interfaz.

---

## Repositorios

Los repositorios son la única capa autorizada para acceder a la persistencia.

La UI nunca debe acceder directamente a la base de datos.

---

## Modelos

Los modelos representan entidades del dominio.

No deben contener lógica específica de presentación.

---

## Tipos

Mantener los tipos separados de las implementaciones cuando sea posible.

Preferir tipos derivados (`as const`, `typeof`) para evitar duplicidad.

---

# Convenciones

## Nombres

Utilizar nombres completos y descriptivos.

Evitar abreviaturas innecesarias.

Preferir claridad sobre brevedad.

---

## Funciones

Cada función debe realizar una única tarea.

Las funciones pequeñas son preferibles a funciones largas con múltiples responsabilidades.

---

## Archivos

Evitar archivos excesivamente grandes.

Si un archivo comienza a crecer demasiado, dividir responsabilidades.

---

# Estado

Mantener el estado lo más local posible.

No introducir soluciones globales (Redux, Zustand, etc.) sin una necesidad clara.

---

# Dependencias

Cada dependencia debe aportar un beneficio claro.

Antes de instalar una librería nueva, evaluar si el problema puede resolverse razonablemente con herramientas existentes.

Reducir la cantidad de dependencias facilita el mantenimiento del proyecto.

---

# Manejo de errores

Nunca ignorar errores silenciosamente.

Toda excepción debe manejarse explícitamente.

Los errores deben proporcionar información útil para facilitar el diagnóstico.

---

# Comentarios

El código debe ser suficientemente claro para minimizar comentarios.

Los comentarios deben explicar:

- decisiones de arquitectura,
- reglas de negocio,
- motivos de diseño,

no describir código evidente.

---

# Calidad del Código

El agente debe priorizar:

- Legibilidad.
- Consistencia.
- Tipado fuerte.
- Mantenibilidad.

Por encima de microoptimizaciones prematuras.

---

# Compatibilidad Futura

Siempre que sea razonable, el diseño debe facilitar futuras migraciones.

Ejemplos:

- Persistencia local → sincronización.
- Aplicación offline → cliente-servidor.
- PWA → aplicación móvil nativa.

Las decisiones de hoy no deben dificultar las posibilidades de mañana.

---

# Filosofía de Desarrollo

Antes de escribir código, el agente debe preguntarse:

- ¿Esta responsabilidad pertenece realmente a esta capa?
- ¿Estoy duplicando lógica existente?
- ¿Existe ya un componente o servicio que pueda reutilizar?
- ¿Este nombre seguirá teniendo sentido dentro de un año?
- ¿Este cambio aumenta el acoplamiento?
- ¿Estoy introduciendo complejidad innecesaria?
- ¿Este diseño facilita futuras migraciones?
- ¿Esta solución será fácil de entender para alguien que nunca haya visto el proyecto?

---

# Rol Esperado del Agente

El agente debe comportarse como un **arquitecto de software**.

No debe limitarse a implementar instrucciones literalmente.

Debe evaluar continuamente la calidad de las decisiones técnicas y proponer mejoras cuando detecte oportunidades.

Si una solicitud rompe la arquitectura existente, el agente debe señalarlo claramente y proponer una alternativa consistente.

---

# Regla Fundamental

**El agente nunca debe sacrificar la arquitectura únicamente para ahorrar unas cuantas líneas de código.**

Si una implementación rápida compromete la mantenibilidad, la escalabilidad o la claridad del sistema, debe proponerse una solución mejor estructurada, incluso si implica escribir algo más de código.

La prioridad es construir software que siga siendo fácil de evolucionar dentro de meses o años, no únicamente resolver el problema inmediato.

---

# Principio Final

**Cada decisión técnica debe dejar el proyecto en un mejor estado del que estaba antes.**

El agente debe procurar que cada cambio:

- mantenga la consistencia del sistema,
- reduzca deuda técnica cuando sea posible,
- preserve la arquitectura existente,
- facilite el trabajo futuro.

El objetivo no es únicamente terminar funcionalidades, sino construir una base sólida sobre la que el proyecto pueda crecer de forma sostenible.
