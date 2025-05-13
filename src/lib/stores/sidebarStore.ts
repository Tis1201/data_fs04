import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Create a store to track expanded menu groups
// Use localStorage to persist the state across page refreshes if in browser
const createExpandedGroupsStore = () => {
  // Initialize from localStorage if available
  const initialValue = browser && localStorage.getItem('sidebarExpandedGroups')
    ? JSON.parse(localStorage.getItem('sidebarExpandedGroups') || '{}')
    : {};
    
  const store = writable<Record<string, boolean>>(initialValue);
  
  // Subscribe to changes and update localStorage
  if (browser) {
    store.subscribe(value => {
      localStorage.setItem('sidebarExpandedGroups', JSON.stringify(value));
    });
  }
  
  return {
    ...store,
    // Helper to toggle a group's expanded state
    toggleGroup: (groupId: string) => {
      store.update(groups => {
        const newGroups = { ...groups };
        newGroups[groupId] = !newGroups[groupId];
        return newGroups;
      });
    },
    // Helper to check if a group is expanded
    isExpanded: (groupId: string, defaultValue: boolean = false) => {
      let result = false;
      
      store.update(groups => {
        // If the group doesn't exist in the store, initialize it with the default value
        if (groups[groupId] === undefined) {
          groups[groupId] = defaultValue;
        }
        result = groups[groupId];
        return groups;
      });
      
      return result;
    }
  };
};

export const expandedGroups = createExpandedGroupsStore();
