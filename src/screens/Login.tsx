import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { Form } from '@/components/ui/Form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RUTA_INICIAL_POR_ROL, RUTAS } from '@/rutas'

/** Estado de navegación que deja `RutaProtegida` al patear a alguien al login. */
interface EstadoDeUbicacion {
  desde?: string
}

export function Login() {
  const { estado, rol, iniciarSesion } = useAuth()
  const ubicacion = useLocation()

  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (estado === 'cargando') {
    return <LoadingScreen mensaje="Verificando tu sesión…" />
  }

  // Ya está logueado: no tiene sentido mostrarle el formulario. Vuelve a donde
  // quería ir antes de que lo mandaran acá, o al inicio de su rol.
  if (estado === 'autenticado' && rol !== null) {
    const estadoPrevio = ubicacion.state as EstadoDeUbicacion | null
    return <Navigate to={estadoPrevio?.desde ?? RUTA_INICIAL_POR_ROL[rol]} replace />
  }

  if (estado === 'sin-perfil') {
    return <Navigate to={RUTAS.sinAcceso} replace />
  }

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    // Validación de UX nada más: la de verdad la hace Supabase.
    if (dni.trim() === '' || password === '') {
      setError('Completá tu DNI y tu contraseña.')
      return
    }

    setEnviando(true)
    setError(null)

    try {
      await iniciarSesion(dni, password)
      // No se navega a mano: al cambiar la sesión, el redirect de arriba se
      // encarga en cuanto el perfil termina de cargar.
    } catch (fallo: unknown) {
      // `iniciarSesion` ya devuelve el mensaje traducido y presentable.
      setError(
        fallo instanceof Error
          ? fallo.message
          : 'No se pudo iniciar sesión. Probá de nuevo.',
      )
      setPassword('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="flex h-full flex-col justify-center overflow-y-auto bg-piedra-100 px-4 py-12">
      <div className="mx-auto w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-marca-800">AIBAR</h1>
          <p className="mt-1 text-base text-piedra-600">Trazabilidad de palets</p>
        </header>

        <Form
          onSubmit={manejarEnvio}
          className="rounded-xl border border-piedra-200 bg-white p-6 shadow-sm"
        >
          <Field label="DNI" requerido>
            {(props) => (
              <Input
                {...props}
                type="text"
                name="username"
                autoComplete="username"
                // Teclado numérico: el DNI son números y así se tipea más
                // rápido y con menos errores desde el celular.
                inputMode="numeric"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="Sin puntos"
                value={dni}
                onChange={(evento) => setDni(evento.target.value)}
                disabled={enviando}
              />
            )}
          </Field>

          <Field label="Contraseña" requerido>
            {(props) => (
              <Input
                {...props}
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(evento) => setPassword(evento.target.value)}
                disabled={enviando}
              />
            )}
          </Field>

          {error !== null && <ErrorMessage mensaje={error} />}

          <Button type="submit" tamaño="lg" anchoCompleto cargando={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </Form>

        <p className="mt-6 text-center text-sm text-piedra-500">
          ¿No tenés cuenta o no podés entrar? Hablá con el encargado del depósito.
        </p>
      </div>
    </main>
  )
}
