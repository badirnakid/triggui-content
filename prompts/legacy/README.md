# Legacy Prompts

Esta carpeta preserva el linaje real de los prompts de Triggui antes de la arquitectura modular.

Su función no es ejecutar nada todavía.  
Su función es:

- preservar contexto histórico
- evitar perder intuiciones valiosas
- comparar contra la nueva arquitectura
- permitir pruebas A/B futuras
- impedir que “mejoras” borren esencia útil

## Fuentes originales

### 1. build-contenido.js
Prompt histórico principal para enriquecer contenido editorial en `triggui-content`.

Características:
- voz editorial evolucionada hacia observacional/universal
- cronobiología
- Hawkins
- anti-repetición
- highlights `[H]...[/H]`
- tarjeta editorial
- verificación automática

### 2. Apps Script
Prompt histórico usado para generar tarjetas/editorial email con otra filosofía.

Características:
- tono más Badir / más cercano / más en primera persona
- mucha presión explícita de variación
- highlights `[H]...[/H]`
- estructura @@BODY
- energía intuitiva fuerte
- divergencia respecto al sistema de `build-contenido.js`

## Regla de uso

Nada dentro de esta carpeta se considera canónico por default.

Todo lo que se rescate de aquí debe pasar por:
1. análisis
2. destilación
3. comparación contra la nueva arquitectura
4. decisión explícita

## Regla de oro

No confundir:
- herencia valiosa
con
- dependencia eterna

La nueva arquitectura modular de Triggui existe para conservar la esencia sin seguir enterrándola dentro del código.