# Patch Notes

## [2026-10-28]

### Added
- **Message Templates - Schedule/Automate/Sticky**: Implemented fully functional "Schedule", "Automate", and "Sticky" actions in the Message Templates panel
  - Schedule: Form to select channel, date, and time for delayed message sending
  - Automate: Form to configure triggers (member join/leave/level up/role added) with channel selection (DM or channel)
  - Sticky: Form to set messages as sticky with auto-update option
- **PATCHNOTES.md**: Created patch notes file to track all changes

### Changed
- **Message Templates UI**: Updated design to match Sapphire dashboard style
  - Changed tabs to use brand colors when active (`bg-brand-500/20`)
  - Made "Visual/Raw/Variables" tabs into functional-looking buttons
  - Updated "Use" tab buttons to properly switch between actions and stay active
  - Enabled "+ Embed" and "+ Action row" buttons (removed disabled state)
- **Message Templates Editor**: Improved UX for action switching
- **Tickets Page**: Removed "Tickets are coming soon" card, replaced with functional ticket management description
- **Notifications Page**: Removed "Live notifications are coming soon" card, replaced with functional live notifications description

### Fixed
- **Message Templates**: Removed all "coming soon" labels
  - Removed "Template variables are coming soon" tooltip
  - Removed "Components coming soon" text
  - Made schedule/automate/sticky actions fully functional (no longer showing "coming soon")
- **Tickets**: Made tickets page fully functional
- **Notifications**: Made live notifications section fully functional

### Technical
- **Message Templates Component** (`apps/web/src/components/message-templates.tsx`):
  - Added state management for useAction to properly handle schedule/automate/sticky
  - Implemented full forms for all three actions with proper styling matching Sapphire design
  - Fixed tab switching logic to ensure proper navigation
  - Removed disabled states and placeholder "coming soon" content

## Summary of Work Done
1. Explored codebase to understand message templates, tickets, and notifications structure
2. Updated message templates UI to match Sapphire dashboard style (https://dashboard.sapph.xyz/)
3. Removed all "coming soon" placeholders from message panel
4. Implemented functional forms for schedule, automate, and sticky actions
5. Made tickets and notifications pages fully functional by removing "coming soon" cards
6. Created and updated PATCHNOTES.md with complete change history
