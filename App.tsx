import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { AuthProvider, useAuth } from './AuthContext';
import LoginScreen from './LoginScreen';
import HomeScreen from './HomeScreen';
import InstitutionsScreen from './InstitutionsScreen';
import ClassesScreen from './ClassesScreen';
import MyClassesScreen from './MyClassesScreen';
import TeachersScreen from './TeachersScreen';
import StudentsScreen from './StudentsScreen';
import ClassChatScreen from './ClassChatScreen';
import DenemeScreen from './DenemeScreen';
import HomeworkScreen from './HomeworkScreen';
import AttendanceScreen from './AttendanceScreen';
import ScheduleScreen from './ScheduleScreen';
import ProfileScreen from './ProfileScreen';
import { Loading } from './ui';
import { LayoutProvider, useLayout } from './design/LayoutContext';
import MobileShell from './design/mobile/Shell';
import DesktopShell from './design/desktop/Shell';

const Tab = createBottomTabNavigator();

function useDisableBrowserTranslate() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = 'tr';
    document.documentElement.setAttribute('translate', 'no');
    document.body?.setAttribute('translate', 'no');
    document.body?.classList.add('notranslate');
    let meta = document.querySelector('meta[name="google"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'google');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'notranslate');
  }, []);
}

function AdaptiveTabBar(props: BottomTabBarProps) {
  const { isMobile } = useLayout();
  return isMobile ? <MobileShell {...props} /> : <DesktopShell {...props} />;
}

function useShellOptions() {
  const { isMobile } = useLayout();
  return {
    tabBar: (props: BottomTabBarProps) => <AdaptiveTabBar {...props} />,
    tabBarPosition: (isMobile ? 'top' : 'left') as 'top' | 'left',
  };
}

function SuperAdminNav() {
  const { tabBar, tabBarPosition } = useShellOptions();
  const { isMobile } = useLayout();
  return (
    <Tab.Navigator
      key={isMobile ? 'mobile' : 'desktop'}
      tabBar={tabBar}
      screenOptions={{
        headerShown: false,
        tabBarPosition,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa' }} />
      <Tab.Screen name="Institutions" component={InstitutionsScreen} options={{ title: 'Kurumlar' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Hesabım' }} />
    </Tab.Navigator>
  );
}

function InstitutionNav() {
  const { user, isManager, isMuhasebe } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const muhasebeOnly = user?.role === 'muhasebe';
  const { tabBar, tabBarPosition } = useShellOptions();
  const { isMobile } = useLayout();

  if (muhasebeOnly) {
    return (
      <Tab.Navigator
        key={isMobile ? 'mobile' : 'desktop'}
        tabBar={tabBar}
        screenOptions={{
          headerShown: false,
          tabBarPosition,
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa' }} />
        <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Ders Programı' }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Hesabım' }} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator
      key={isMobile ? 'mobile' : 'desktop'}
      tabBar={tabBar}
      screenOptions={{
        headerShown: false,
        tabBarPosition,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa' }} />
      {isTeacher && isManager ? (
        <Tab.Screen name="Classes" component={ClassesScreen} options={{ title: 'Sınıflar' }} />
      ) : null}
      {isTeacher && !isManager ? (
        <Tab.Screen name="MyClasses" component={MyClassesScreen} options={{ title: 'Sınıflarım' }} />
      ) : null}
      {isTeacher && isManager ? (
        <Tab.Screen name="Teachers" component={TeachersScreen} options={{ title: 'Öğretmenler' }} />
      ) : null}
      {isTeacher ? (
        <Tab.Screen name="Students" component={StudentsScreen} options={{ title: 'Öğrenciler' }} />
      ) : null}
      {isTeacher ? (
        <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ title: 'Yoklama' }} />
      ) : null}
      <Tab.Screen name="Chat" component={ClassChatScreen} options={{ title: 'Sınıf Sohbeti' }} />
      <Tab.Screen name="Deneme" component={DenemeScreen} options={{ title: 'Denemeler' }} />
      <Tab.Screen name="Homework" component={HomeworkScreen} options={{ title: 'Ödevler' }} />
      {(isTeacher || isStudent || isMuhasebe) ? (
        <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Ders Programı' }} />
      ) : null}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Hesabım' }} />
    </Tab.Navigator>
  );
}

function RootNav() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <LoginScreen />;
  return (
    <NavigationContainer>
      {user.role === 'superadmin' ? <SuperAdminNav /> : <InstitutionNav />}
    </NavigationContainer>
  );
}

export default function App() {
  useDisableBrowserTranslate();

  return (
    <LayoutProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNav />
      </AuthProvider>
    </LayoutProvider>
  );
}
