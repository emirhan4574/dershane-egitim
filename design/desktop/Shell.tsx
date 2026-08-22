import React from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../AuthContext';
import { Icon } from '../../icons';
import { colors, fonts, radius } from '../../theme';
import { NAV_ICONS, roleLabelText } from '../nav';
import { ClassesNavItem, ClassSubParams, classSubActiveKey } from '../ClassesNavItem';
import { TeachersNavItem, TeacherSubParams, teacherSubActiveKey } from '../TeachersNavItem';
import { StudentsNavItem, StudentSubParams, studentSubActiveKey } from '../StudentsNavItem';
import { ChatNavItem, ChatSubParams, chatSubActiveKey } from '../ChatNavItem';
import { DenemeNavItem, DenemeSubParams, denemeSubActiveKey } from '../DenemeNavItem';
import { YoklamaNavItem, YoklamaSubParams, yoklamaSubActiveKey } from '../YoklamaNavItem';
import { HomeworkNavItem, HomeworkSubParams, homeworkSubActiveKey } from '../HomeworkNavItem';
import { DersProgramiNavItem, ScheduleSubParams, scheduleSubActiveKey } from '../DersProgramiNavItem';

/** Masaüstü kabuk: sabit sol sidebar */
export default function DesktopShell({ state, descriptors, navigation }: BottomTabBarProps) {
  const { logout, user, isManager, isMuhasebe } = useAuth();

  const go = (routeName: string, focused: boolean, routeKey: string) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const goClasses = (params: ClassSubParams) => {
    navigation.navigate('Classes', params);
  };

  const goTeachers = (params: TeacherSubParams) => {
    navigation.navigate('Teachers', params);
  };

  const goStudents = (params: StudentSubParams) => {
    navigation.navigate('Students', params);
  };

  const goChat = (params: ChatSubParams) => {
    navigation.navigate('Chat', params);
  };

  const goDeneme = (params: DenemeSubParams) => {
    navigation.navigate('Deneme', params);
  };

  const goYoklama = (params: YoklamaSubParams) => {
    navigation.navigate('Attendance', params);
  };

  const goHomework = (params: HomeworkSubParams) => {
    navigation.navigate('Homework', params);
  };

  const goSchedule = (params: ScheduleSubParams) => {
    navigation.navigate('Schedule', params);
  };

  const classesRoute = state.routes.find((r) => r.name === 'Classes');
  const classesActiveKey = classSubActiveKey(classesRoute?.params);
  const teachersRoute = state.routes.find((r) => r.name === 'Teachers');
  const teachersActiveKey = teacherSubActiveKey(teachersRoute?.params);
  const studentsRoute = state.routes.find((r) => r.name === 'Students');
  const studentsActiveKey = studentSubActiveKey(studentsRoute?.params);
  const chatRoute = state.routes.find((r) => r.name === 'Chat');
  const chatActiveKey = chatSubActiveKey(chatRoute?.params);
  const denemeRoute = state.routes.find((r) => r.name === 'Deneme');
  const denemeActiveKey = denemeSubActiveKey(denemeRoute?.params);
  const attendanceRoute = state.routes.find((r) => r.name === 'Attendance');
  const attendanceActiveKey = yoklamaSubActiveKey(attendanceRoute?.params);
  const homeworkRoute = state.routes.find((r) => r.name === 'Homework');
  const homeworkActiveKey = homeworkSubActiveKey(homeworkRoute?.params);
  const scheduleRoute = state.routes.find((r) => r.name === 'Schedule');
  const scheduleActiveKey = scheduleSubActiveKey(scheduleRoute?.params);
  const isTeacher = user?.role === 'teacher';
  const showMuhasebeSchedule = isMuhasebe;

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>Dershane</Text>
        <Text style={styles.role}>{roleLabelText(user?.role, isManager, isMuhasebe)}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const focused = state.index === index;
          const icon = NAV_ICONS[route.name] || 'ellipse';

          if (route.name === 'Classes') {
            return (
              <ClassesNavItem
                key={route.key}
                focused={focused}
                activeKey={focused ? classesActiveKey : null}
                onNavigate={goClasses}
              />
            );
          }

          if (route.name === 'Teachers') {
            return (
              <TeachersNavItem
                key={route.key}
                focused={focused}
                activeKey={focused ? teachersActiveKey : null}
                onNavigate={goTeachers}
              />
            );
          }

          if (route.name === 'Students') {
            return (
              <StudentsNavItem
                key={route.key}
                focused={focused}
                activeKey={focused ? studentsActiveKey : null}
                onNavigate={goStudents}
              />
            );
          }

          if (route.name === 'Chat' && isTeacher) {
            return (
              <ChatNavItem
                key={route.key}
                focused={focused}
                activeKey={focused ? chatActiveKey : null}
                onNavigate={goChat}
              />
            );
          }

          if (route.name === 'Deneme' && isTeacher) {
            return (
              <DenemeNavItem
                key={route.key}
                focused={focused}
                activeKey={focused ? denemeActiveKey : null}
                onNavigate={goDeneme}
              />
            );
          }

          if (route.name === 'Attendance' && isTeacher) {
            return (
              <YoklamaNavItem
                key={route.key}
                focused={focused}
                activeKey={focused ? attendanceActiveKey : null}
                onNavigate={goYoklama}
              />
            );
          }

          if (route.name === 'Homework' && isTeacher) {
            return (
              <HomeworkNavItem
                key={route.key}
                focused={focused}
                activeKey={focused ? homeworkActiveKey : null}
                onNavigate={goHomework}
              />
            );
          }

          if (route.name === 'Schedule' && showMuhasebeSchedule) {
            return (
              <DersProgramiNavItem
                key={route.key}
                focused={focused}
                activeKey={focused ? scheduleActiveKey : null}
                onNavigate={goSchedule}
              />
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={() => go(route.name, focused, route.key)}
              style={[styles.navItem, focused && styles.navItemOn]}
            >
              <Icon name={icon} size={22} color={focused ? '#FFFFFF' : colors.railMuted} />
              <Text style={[styles.navText, focused && styles.navTextOn]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={logout} style={styles.logoutBtn}>
        <Icon name="log-out-outline" size={20} color="#FFFFFF" />
        <Text style={styles.logoutText}>Çıkış yap</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 248,
    backgroundColor: colors.rail,
    paddingTop: 28,
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  brandBlock: {
    paddingHorizontal: 10,
    marginBottom: 22,
  },
  brand: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 22,
  },
  role: {
    marginTop: 6,
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 13,
    color: colors.railMuted,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  navItemOn: { backgroundColor: colors.brand },
  navText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 15,
    color: colors.railMuted,
    flex: 1,
  },
  navTextOn: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  logoutText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 14,
  },
});
