import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Descriptions, Input, Modal, Select, Upload } from 'antd';
import { Camera, KeyRound, LogOut, Pencil, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { tokens } from '@/app/theme';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CurrentUser, ProfilePayload } from '@/api/types';
import { useCurrentUser, useLogout } from '@/auth/auth';
import { roleLabel } from '@/features/auth/roles';
import { formatPhone } from '@/features/auth/validation';
import { Field } from '@/shared/FormField';

const AVATAR_LIMIT = 500 * 1024;

const toValues = (u: CurrentUser): ProfilePayload => ({
  lastName: u.lastName,
  firstName: u.firstName,
  middleName: u.middleName ?? '',
  phone: formatPhone(u.phone),
  email: u.email,
  region: u.region,
});

/** Поля профиля: те же при первом входе и при редактировании */
function ProfileFields({
  values,
  errors,
  onChange,
}: {
  values: ProfilePayload;
  errors: Record<string, string>;
  onChange: (patch: Partial<ProfilePayload>) => void;
}) {
  const regions = useQuery({ queryKey: queryKeys.regions, queryFn: api.dictionaries.regions, staleTime: Infinity });
  return (
    <div className="flex flex-col gap-4">
      <Field label="Фамилия" htmlFor="profile-last" required error={errors.lastName}>
        <Input id="profile-last" value={values.lastName} status={errors.lastName ? 'error' : undefined} onChange={(e) => onChange({ lastName: e.target.value })} />
      </Field>
      <Field label="Имя" htmlFor="profile-first" required error={errors.firstName}>
        <Input id="profile-first" value={values.firstName} status={errors.firstName ? 'error' : undefined} onChange={(e) => onChange({ firstName: e.target.value })} />
      </Field>
      <Field label="Отчество" htmlFor="profile-middle">
        <Input id="profile-middle" value={values.middleName} onChange={(e) => onChange({ middleName: e.target.value })} />
      </Field>
      <Field label="Телефон" htmlFor="profile-phone" required error={errors.phone}>
        <Input
          id="profile-phone"
          inputMode="tel"
          value={values.phone}
          status={errors.phone ? 'error' : undefined}
          onChange={(e) => onChange({ phone: formatPhone(e.target.value) })}
        />
      </Field>
      <Field label="Email" htmlFor="profile-email" required error={errors.email}>
        <Input id="profile-email" type="email" value={values.email} status={errors.email ? 'error' : undefined} onChange={(e) => onChange({ email: e.target.value })} />
      </Field>
      <Field label="Область" htmlFor="profile-region" error={errors.region}>
        <Select
          id="profile-region"
          aria-label="Область"
          className="w-full"
          style={{ width: '100%' }}
          showSearch={{ optionFilterProp: 'label' }}
          value={values.region}
          options={(regions.data ?? []).map((r) => ({ value: r.name, label: r.name }))}
          onChange={(region) => onChange({ region })}
        />
      </Field>
    </div>
  );
}

function useSaveProfile(onDone: () => void) {
  const qc = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: api.auth.updateProfile,
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.me, user);
      setErrors({});
      onDone();
    },
    onError: (e) => setErrors(isApiError(e) ? e.fieldErrors : {}),
  });
  return { save, errors, setErrors };
}

/** Приветственный экран первого входа: проверка и заполнение обязательных данных профиля */
export function OnboardingProfile({ user }: { user: CurrentUser }) {
  const { message } = App.useApp();
  const logout = useLogout();
  const [values, setValues] = useState(() => toValues(user));
  const { save, errors, setErrors } = useSaveProfile(() => message.success('Профиль сохранён. Добро пожаловать!'));

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      <Card className="w-full max-w-xl" data-testid="onboarding">
        <h1 className="m-0 text-2xl font-bold text-text">Добро пожаловать в Sanastra!</h1>
        <p className="mt-1 mb-6 text-muted">Это ваш первый вход. Проверьте данные профиля и при необходимости исправьте их.</p>
        <form
          noValidate
          aria-label="Данные профиля"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(values);
          }}
        >
          <ProfileFields
            values={values}
            errors={errors}
            onChange={(patch) => {
              setValues((v) => ({ ...v, ...patch }));
              setErrors({});
            }}
          />
          {save.isError && !Object.keys(errors).length && <Alert className="mt-4" type="error" showIcon title={save.error.message} />}
          <div className="mt-6 flex items-center justify-between gap-2">
            <Button icon={<LogOut size={16} />} onClick={() => logout.mutate()}>
              Выйти
            </Button>
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              Сохранить и продолжить
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function EditProfileModal({ user, onClose }: { user: CurrentUser; onClose: () => void }) {
  const { message } = App.useApp();
  const [values, setValues] = useState(() => toValues(user));
  const { save, errors, setErrors } = useSaveProfile(() => {
    message.success('Данные профиля сохранены');
    onClose();
  });
  return (
    <Modal
      open
      title="Личные данные"
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => save.mutate(values)}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="pt-2">
        <ProfileFields
          values={values}
          errors={errors}
          onChange={(patch) => {
            setValues((v) => ({ ...v, ...patch }));
            setErrors({});
          }}
        />
        {save.isError && !Object.keys(errors).length && <Alert className="mt-4" type="error" showIcon title={save.error.message} />}
      </div>
    </Modal>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { message } = App.useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const change = useMutation({
    mutationFn: () => api.auth.changePassword(current, next),
    onSuccess: () => {
      message.success('Пароль изменён');
      onClose();
    },
  });
  const fe = isApiError(change.error) ? change.error.fieldErrors : {};
  const mismatch = repeat.length > 0 && repeat !== next;
  return (
    <Modal
      open
      title="Смена пароля"
      okText="Сменить пароль"
      cancelText="Отмена"
      confirmLoading={change.isPending}
      okButtonProps={{ disabled: !current || !next || repeat !== next }}
      onOk={() => change.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4 pt-2">
        <Field label="Текущий пароль" htmlFor="pw-current" required error={fe.currentPassword}>
          <Input.Password id="pw-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="Новый пароль" htmlFor="pw-next" required error={fe.newPassword}>
          <Input.Password id="pw-next" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Повторите новый пароль" htmlFor="pw-repeat" required error={mismatch ? 'Пароли не совпадают' : undefined}>
          <Input.Password id="pw-repeat" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/** Карточка профиля: личные данные, аватар, смена пароля. */
export function ProfileCard({ user, organizationName }: { user: CurrentUser; organizationName?: string }) {
  const logout = useLogout();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [modal, setModal] = useState<'edit' | 'password' | null>(null);
  const saveAvatar = useMutation({
    mutationFn: (avatar: string | null) => api.auth.updateProfile({ ...toValues(user), avatar }),
    onSuccess: (next) => qc.setQueryData(queryKeys.me, next),
    onError: (e) => message.error(e.message),
  });

  const pickAvatar = (file: File) => {
    if (!file.type.startsWith('image/')) message.error('Выберите изображение');
    else if (file.size > AVATAR_LIMIT) message.error('Изображение до 500 КБ');
    else {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' && saveAvatar.mutate(reader.result);
      reader.readAsDataURL(file);
    }
    return false;
  };

  return (
    <Card>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar size={56} src={user.avatar} icon={<UserRound size={24} />} style={{ background: tokens.colorPrimary }} />
        <div className="min-w-0">
          <div className="text-lg font-semibold">{user.fullName}</div>
          <div className="text-muted">{roleLabel(user)}</div>
        </div>
        <span className="flex gap-2 sm:ml-auto">
          <Upload accept="image/*" showUploadList={false} beforeUpload={pickAvatar}>
            <Button icon={<Camera size={16} />} loading={saveAvatar.isPending}>
              Обновить аватар
            </Button>
          </Upload>
          {user.avatar && (
            <Button icon={<Trash2 size={16} />} aria-label="Удалить аватар" onClick={() => saveAvatar.mutate(null)} />
          )}
        </span>
      </div>
      <Descriptions
        column={1}
        items={[
          { key: 'iin', label: 'ИИН', children: user.iin },
          { key: 'region', label: 'Область', children: user.region },
          { key: 'phone', label: 'Телефон', children: formatPhone(user.phone) },
          { key: 'email', label: 'Email', children: user.email },
          ...(organizationName ? [{ key: 'org', label: 'Организация', children: organizationName }] : []),
        ]}
      />
      <div className="mt-6 flex flex-wrap gap-2">
        <Button icon={<Pencil size={16} />} onClick={() => setModal('edit')}>
          Изменить данные
        </Button>
        <Button icon={<KeyRound size={16} />} onClick={() => setModal('password')}>
          Сменить пароль
        </Button>
        <Button icon={<LogOut size={16} />} onClick={() => logout.mutate()}>
          Выйти
        </Button>
      </div>
      {modal === 'edit' && <EditProfileModal user={user} onClose={() => setModal(null)} />}
      {modal === 'password' && <ChangePasswordModal onClose={() => setModal(null)} />}
    </Card>
  );
}

/** Профиль в панели суперадминистратора */
export function SuperadminProfilePage() {
  const { data: user } = useCurrentUser();
  if (!user) return null;
  return (
    <div className="flex flex-col gap-4 pb-6">
      <h1 className="m-0 text-2xl font-semibold text-text">Профиль</h1>
      <ProfileCard user={user} />
    </div>
  );
}
