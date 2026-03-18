import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/login')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/login"!</div>
}
