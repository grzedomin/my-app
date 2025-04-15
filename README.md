This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Data Fetching with React Query

This application uses TanStack Query (React Query) for efficient data fetching with automatic caching. React Query helps:

- Reduce unnecessary network requests
- Maintain a consistent cache
- Provide loading and error states
- Handle refetching when data becomes stale
- Optimize performance

### Using Query Hooks

The app provides several custom React Query hooks for data fetching:

#### File Operations

```tsx
// Get all files
const { data, isLoading, error } = useAllFiles();

// Get files for a specific user
const { data, isLoading, error } = useUserFiles(userId);

// Get a specific file by ID
const { data, isLoading, error } = useFileById(fileId);

// Get files by date (and optionally filter by sport type)
const { data, isLoading, error } = useFilesByDate(date, sportType);

// Get files by sport type
const { data, isLoading, error } = useFilesBySportType(sportType);

// Upload a file (mutation)
const { mutate, isLoading } = useUploadFile();
mutate({
  file,
  userId,
  path: "optional/path",
  fileDate: "optional-date",
  sportType: "tennis"
});

// Upload multiple files (mutation)
const { mutate, isLoading } = useUploadMultipleFiles();
mutate({ files, userId, path: "optional/path", sportType: "tennis" });

// Delete a file (mutation)
const { mutate, isLoading } = useDeleteFile();
mutate(fileId);
```

#### Firestore Operations

For generic Firestore operations:

```tsx
// Get all documents from a collection
const { data, isLoading, error } = useCollection("collection-name");

// Get a specific document
const { data, isLoading, error } = useDocument("collection-name", "doc-id");

// Get filtered documents
const { data, isLoading, error } = useFilteredCollection(
  "collection-name",
  "fieldName",
  fieldValue,
  "sortField", // optional
  "desc", // optional
  10 // optional limit
);

// Add a document (mutation)
const { mutate, isLoading } = useAddDocument("collection-name");
mutate(newDocumentData);

// Set a document (mutation)
const { mutate, isLoading } = useSetDocument("collection-name");
mutate({ id: "doc-id", data: documentData });

// Update a document (mutation)
const { mutate, isLoading } = useUpdateDocument("collection-name");
mutate({ id: "doc-id", data: { field: "new-value" } });

// Delete a document (mutation)
const { mutate, isLoading } = useDeleteDocument("collection-name");
mutate("doc-id");
```

#### Match Data

For fetching sports match data:

```tsx
// Get match data by date and sport type
const { apiPlayerNames, apiMatchScores, apiMatchSetScores, findBestPlayerMatch, isLoading, error } =
  useMatchesByDate(selectedDate, "tennis");
```

### Cache Configuration

React Query is configured with these default settings:

- **Stale Time**: 5 minutes - Data won't refetch until 5 minutes have passed
- **Cache Time**: 1 hour - Unused data remains in memory for 1 hour
- **Retry**: 1 - Failed requests retry once
- **Refetch on Window Focus**: Disabled - Data won't automatically refetch when the user returns to the tab

### DevTools

In development mode, React Query DevTools are available to inspect cache contents and query states. The DevTools panel appears at the bottom of the screen.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
