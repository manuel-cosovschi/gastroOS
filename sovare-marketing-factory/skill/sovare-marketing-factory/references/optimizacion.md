# Optimización

`optimize_analyze` muestra; `optimize_run` ejecuta lo autorizado. La tarea programada corre a las 9 y a las 18 (hora argentina).

## Reglas (configurables en `settings_update` → `optimizer`)

1. **Muestra mínima**: menos de 3.000 impresiones o $5.000 gastados → «sin datos suficientes». No se toca.
2. **CTR bajo**: se compara con el resto de los anuncios del producto con intervalos de Wilson al 95%. Sólo si el mejor caso del anuncio es peor que el peor caso del resto, se propone pausarlo.
3. **Costo por consulta** (sólo si el dueño cargó `target_cpl_ars` del producto): sin consultas tras gastar 3× el objetivo, o CPL > 2× el objetivo con al menos 3 consultas → pausar.
4. **Fatiga**: frecuencia ≥ 3,5 y CTR de la segunda mitad del período 35% menor que la primera → creativo agotado, se encolan variantes nuevas.
5. **Reparto**: entre campañas activas del mismo producto con ≥ 5 consultas cada una, si una tiene CPL 1,5× peor, se mueve hasta el % máximo de la política hacia la mejor. Se dice explícitamente que es una diferencia observada, no una causa probada.
6. **Alertas**: activa > 24 h sin impresiones; gasto de 2 días mayor a 2,5× el diario.

## Cómo hablar de resultados

- Diferencias con muestra chica: «todavía no se puede decir».
- Meta estima conversiones (modela lo que no ve); la base del producto confirma. Mostrá los dos.
- Una variante que rinde mejor no «causó» más ventas: rindió mejor en ese período, con ese público. El optimizador mueve poco y revisa todos los días por eso.
- Sin `target_cpl_ars` no hay juicio por costo: si el usuario quiere que pause por CPL, preguntale el número y cargalo con `settings_update`.
