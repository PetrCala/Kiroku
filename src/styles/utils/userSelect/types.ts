type UserSelectStyles = Record<
  'userSelectText' | 'userSelectNone',
  {
    userSelect?: 'none' | 'auto' | 'text';
    WebkitUserSelect?: 'none' | 'auto' | 'text';
  }
>;

export default UserSelectStyles;
