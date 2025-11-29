import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/termine/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/termine/$id"!</div>
}
