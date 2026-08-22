import React, { useState } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

/** Mobil kabuk: üst bar + hamburger drawer */
export default function MobileShell({ state, descriptors, navigation }: BottomTabBarProps) {
  const [open, setOpen] = useState(false);
  const { logout, user, isManager, isMuhasebe } = useAuth();

  const current =
    typeof descriptors[state.routes[state.index].key].options.title === 'string'
      ? (descriptors[state.routes[state.index].key].options.title as string)
      : state.routes[state.index].name;

  const go = (routeName: string, focused: boolean, routeKey: string) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
    setOpen(false);
  };

  const goClasses = (params: ClassSubParams) => {
    navigation.navigate('Classes', params);
    setOpen(false);
  };

  const goTeachers = (params: TeacherSubParams) => {
    navigation.navigate('Teachers', params);
    setOpen(false);
  };

  const goStudents = (params: StudentSubParams) => {
    navigation.navigate('Students', params);
    setOpen(false);
  };

  const goChat = (params: ChatSubParams) => {
    navigation.navigate('Chat', params);
    setOpen(false);
  };

  const goDeneme = (params: DenemeSubParams) => {
    navigation.navigate('Deneme', params);
    setOpen(false);
  };

  const goYoklama = (params: YoklamaSubParams) => {
    navigation.navigate('Attendance', params);
    setOpen(false);
  };

  const goHomework = (params: HomeworkSubParams) => {
    navigation.navigate('Homework', params);
    setOpen(false);
  };

  const goSchedule = (params: ScheduleSubParams) => {
    navigation.navigate('Schedule', params);
    setOpen(false);
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
    <>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Menüyü kapat' : 'Menüyü aç'}
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [styles.burgerBtn, pressed && { opacity: 0.8 }]}
        >
          <Icon name="menu" size={34} color="#FFFFFF" />
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topBrand}>Dershane</Text>
          <Text style={styles.topPage} numberOfLines={1}>
            {current}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Hesabım"
          onPress={() => navigation.navigate('Profile')}
          style={styles.profileBtn}
        >
          <Icon name="person-circle" size={34} color="#FFFFFF" />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.drawerWrap}>
          <View style={styles.drawer}>
            <View style={styles.drawerTop}>
              <Text style={styles.drawerBrand}>Menü</Text>
              <Pressable
                accessibilityLabel="Menüyü kapat"
                onPress={() => setOpen(false)}
                style={styles.closeBtn}
              >
                <Icon name="close" size={30} color="#FFFFFF" />
              </Pressable>
            </View>

            <Text style={styles.drawerRole}>{roleLabelText(user?.role, isManager, isMuhasebe)}</Text>

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
                      compact
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
                      compact
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
                      compact
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
                      compact
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
                      compact
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
                      compact
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
                      compact
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
                      compact
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
                    <Icon name={icon} size={26} color={focused ? '#FFFFFF' : colors.railMuted} />
                    <Text style={[styles.navText, focused && styles.navTextOn]} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => {
                setOpen(false);
                logout();
              }}
              style={styles.logoutBtn}
            >
              <Icon name="log-out-outline" size={24} color="#FFFFFF" />
              <Text style={styles.logoutText}>Çıkış yap</Text>
            </Pressable>
          </View>

          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    backgroundColor: colors.rail,
    paddingTop: Platform.OS === 'web' ? 10 : 14,
    paddingBottom: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  burgerBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  topCenter: { flex: 1 },
  topBrand: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 18,
  },
  topPage: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    color: colors.railMuted,
    fontSize: 13,
    marginTop: 1,
  },
  profileBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerWrap: { flex: 1, flexDirection: 'row' },
  drawer: {
    width: 300,
    maxWidth: '88%',
    backgroundColor: colors.rail,
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  drawerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  drawerBrand: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 24,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  drawerRole: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.railMuted,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  navItemOn: { backgroundColor: colors.brand },
  navText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 17,
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
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  logoutText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
});
