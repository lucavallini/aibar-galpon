import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

/**
 * Preparación del entorno de tests.
 *
 * `fake-indexeddb/auto` instala una IndexedDB en memoria: la cola offline es
 * una de las piezas que más importa probar y sin esto no correría fuera del
 * navegador.
 */
