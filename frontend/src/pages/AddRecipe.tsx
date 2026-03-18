import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function AddRecipe() {
  return (
    <div className="container-page pt-6 md:pt-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Add recipe</h1>
        <p className="mt-1 text-sm text-muted">Create one manually or import from a URL.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="flex h-full flex-col hover:bg-surface2/40 transition">
          <CardHeader>
            <CardTitle>Manual</CardTitle>
            <CardDescription>Write your own recipe with ingredients, instructions, and images.</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-4">
            <Link to="/add/manual">
              <Button variant="primary">Create recipe</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col hover:bg-surface2/40 transition">
          <CardHeader>
            <CardTitle>Import from URL</CardTitle>
            <CardDescription>Paste a link and confirm the extracted recipe.</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-4">
            <Link to="/add/import">
              <Button variant="secondary">Import recipe</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

