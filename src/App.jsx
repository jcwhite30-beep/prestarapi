import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function App() {
  const [clientes, setClientes] = useState([])
  const [nombre, setNombre] = useState('')

  async function cargar() {
    const { data } = await supabase.from('clientes').select('*')
    setClientes(data || [])
  }

  async function agregar() {
    if (!nombre) return
    await supabase.from('clientes').insert({ nombre })
    setNombre('')
    cargar()
  }

  useEffect(() => { cargar() }, [])

  return (
    <div style={{padding:20}}>
      <h1>PrestaRapi 🚀</h1>

      <input 
        value={nombre}
        onChange={e=>setNombre(e.target.value)}
        placeholder="Nombre cliente"
      />
      <button onClick={agregar}>Agregar</button>

      <ul>
        {clientes.map(c=>(
          <li key={c.id}>{c.nombre}</li>
        ))}
      </ul>
    </div>
  )
}
