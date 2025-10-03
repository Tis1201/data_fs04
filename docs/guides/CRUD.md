# CRUD Operations Guide

## Standard Flow
1. Start with `zenstack schema.zmodel`
2. Define your model and relationships
3. Create corresponding Zod schemas for validation
4. Implement CRUDL operations using the API utilities

## API Utilities

### Generic API Functions

#### `api_delete<T>(endpoint: string, id: string, errorMessage?: string): Promise<ApiResponse<T>>`
- **Purpose**: Generic DELETE request handler
- **Usage**:
  ```typescript
  try {
    await api_delete<YourType>('/api/your-resource', id);
    // Handle success
  } catch (error) {
    // Handle error
  }
  ```

#### `api_patch<T>(endpoint: string, data: object, errorMessage?: string): Promise<ApiResponse<T>>`
- **Purpose**: Generic PATCH request handler
- **Usage**:
  ```typescript
  try {
    const result = await api_patch<YourType>('/api/your-resource', updateData);
    // Handle success
  } catch (error) {
    // Handle error
  }
  ```

### Error Handling
- All API utilities throw exceptions on errors
- Catch errors in the component layer and show user-friendly messages
- Use toast notifications for user feedback

## Implementation Guide

### For Listing
- Refer to [LISTING_TABLE.md](LISTING_TABLE.md)
- Use `svelte-headless-table` for consistent table implementation
- Implement sorting, filtering, and pagination at the API level

### For Creating (/new)
- Refer to [CREATE_FORM.md](CREATE_FORM.md)
- Use `sveltekit-superforms` with Zod validation
- Follow the form component pattern in existing implementations

### For Updating (/:id)
- Refer to [UPDATE_FORM.md](UPDATE_FORM.md)
- Use the same form components as create, but pre-populated
- Handle optimistic updates for better UX

## Best Practices
1. **Consistent Error Handling**: Always use try/catch blocks when calling API utilities
2. **Type Safety**: Always specify the expected return type using TypeScript generics
3. **Loading States**: Show loading indicators during async operations
4. **User Feedback**: Provide clear feedback for all user actions
5. **Security**: Always validate and sanitize inputs on both client and server
6. **Performance**: Implement proper loading states and optimistic updates

## Example Implementation
```typescript
// In your component
async function handleDelete(id: string) {
  try {
    setDeletingId(id);
    await api_delete<FactoryToken>('/api/factory-tokens', id);
    toast.success('Token deleted successfully');
    // Refresh data or update local state
  } catch (error) {
    toast.error(error.message || 'Failed to delete token');
  } finally {
    setDeletingId(null);
  }
}
```







