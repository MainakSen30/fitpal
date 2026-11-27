import React from 'react';
import { Redirect } from 'expo-router';
import { useSessionSnapshot } from '../src/lib/session';

export default function Index() {
  const state = useSessionSnapshot();
  return <Redirect href={state.status === 'authenticated' ? '/(tabs)' : '/(auth)/login'} />;
}
