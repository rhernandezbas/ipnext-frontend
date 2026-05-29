<!-- generated from engram topic_key: sdd/task-datetime-validation/design -->
## Approach
Use react-hook-form's `useWatch` for startDate and `getValues`+`setValue` to manipulate endDate. No extra state needed — "user edited End" is encoded as "End is non-empty when Start changes".

## Implementation sketch in DatosForm.tsx

```ts
const watchedStartDate = useWatch({ control, name: 'startDate' });

useEffect(() => {
  if (!watchedStartDate) return;
  const currentEnd = getValues('endDate');
  if (currentEnd) return; // REQ-DATE-3: don't override
  const start = new Date(watchedStartDate);
  if (isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  // Format as YYYY-MM-DDTHH:mm without UTC conversion (datetime-local is local)
  const pad = (n: number) => String(n).padStart(2, '0');
  const localEnd = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
  setValue('endDate', localEnd, { shouldDirty: true, shouldValidate: false });
}, [watchedStartDate]);
```

The endDate input adds:
```tsx
disabled={!watchedStartDate}
```

## Why this approach
- No new state — `useWatch` reactively follows startDate.
- "Empty End" check naturally satisfies REQ-DATE-2 and REQ-DATE-3.
- Uses local date arithmetic since datetime-local is local time (avoid TZ shift).

## Test plan
Add 4 cases to DatosForm.test.tsx:
1. End input disabled when initial start/end both null.
2. End input enabled when initial start has value.
3. Typing Start in empty form auto-fills End to Start+1h.
4. Changing Start with pre-existing End does NOT override End.
