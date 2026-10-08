import { notFound } from 'next/navigation';

// Any address no page answers ends up here, inside the language's layout, so
// "not found" is said in the reader's language, with the site around it,
// rather than as a bare page.
export default function UnknownPage() {
  notFound();
}
