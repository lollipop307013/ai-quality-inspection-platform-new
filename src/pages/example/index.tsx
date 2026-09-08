import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  Empty,
  Input,
  Loading,
  MessagePlugin,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'tdesign-react';
import type { PrimaryTableCol, SelectValue } from 'tdesign-react';
import { usePageScenario } from '@/pageScenario';
import { useCurrentBusiness } from '@/prototypeContext';
import type { ExamplePageScenario } from './scenarios';
import styles from './index.module.less';

interface AgentApplication {
  id: number;
  name: string;
  owner: string;
  updatedAt: string;
  enabled: boolean;
}

const initialApplications: AgentApplication[] = [
  {
    id: 1,
    name: '知识问答助手',
    owner: '张晨',
    updatedAt: '2026-08-12 16:32',
    enabled: true,
  },
  {
    id: 2,
    name: '运营数据分析',
    owner: '李楠',
    updatedAt: '2026-08-11 10:18',
    enabled: true,
  },
  {
    id: 3,
    name: '内容审核助手',
    owner: '王喆',
    updatedAt: '2026-08-08 18:06',
    enabled: false,
  },
];

const boundaryApplications: AgentApplication[] = [
  ...initialApplications,
  {
    id: 4,
    name: '面向全球发行团队的多语言游戏内容审核与风险识别助手',
    owner: '欧阳子墨（全球内容安全中心）',
    updatedAt: '2026-08-13 09:46',
    enabled: true,
  },
];

const getApplicationsByGameId = (gameId: string) => {
  if (gameId === 'mock-game-ai-platform') return initialApplications.slice(0, 2);
  if (gameId === 'mock-game-content-creation') {
    return initialApplications.filter(({ id }) => id !== 2);
  }

  return initialApplications;
};

const getScenarioApplications = (
  previewScenario: ExamplePageScenario,
  gameId: string,
) => {
  if (previewScenario === 'empty' || previewScenario === 'loading') return [];
  if (previewScenario === 'boundary') return boundaryApplications;

  return getApplicationsByGameId(gameId);
};

type ListLoadState = 'ready' | 'loading' | 'error';

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '已启用', value: 'enabled' },
  { label: '已停用', value: 'disabled' },
];

const formatCurrentTime = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export default function ExamplePage() {
  const previewScenario = usePageScenario<ExamplePageScenario>();
  const { game_id } = useCurrentBusiness();
  const initialKeyword = previewScenario === 'no-result' ? '海外发行知识库' : '';
  const [applications, setApplications] = useState(() => (
    getScenarioApplications(previewScenario, game_id)
  ));
  const [keyword, setKeyword] = useState(initialKeyword);
  const [status, setStatus] = useState<SelectValue>('all');
  const [appliedKeyword, setAppliedKeyword] = useState(initialKeyword);
  const [appliedStatus, setAppliedStatus] = useState<SelectValue>('all');
  const [listLoadState, setListLoadState] = useState<ListLoadState>(() => {
    if (previewScenario === 'loading') return 'loading';
    if (previewScenario === 'error') return 'error';
    return 'ready';
  });
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [applicationName, setApplicationName] = useState('');
  const [owner, setOwner] = useState('');

  useEffect(() => {
    setApplications(getScenarioApplications(previewScenario, game_id));
    setDialogVisible(false);
    setEditingId(null);
    setApplicationName('');
    setOwner('');
  }, [game_id, previewScenario]);

  const filteredApplications = useMemo(() => {
    const normalizedKeyword = appliedKeyword.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesKeyword = !normalizedKeyword
        || application.name.toLowerCase().includes(normalizedKeyword);
      const matchesStatus = appliedStatus === 'all'
        || (appliedStatus === 'enabled' && application.enabled)
        || (appliedStatus === 'disabled' && !application.enabled);

      return matchesKeyword && matchesStatus;
    });
  }, [applications, appliedKeyword, appliedStatus]);

  const closeDialog = () => {
    setDialogVisible(false);
    setEditingId(null);
    setApplicationName('');
    setOwner('');
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setApplicationName('');
    setOwner('');
    setDialogVisible(true);
  };

  const openEditDialog = (application: AgentApplication) => {
    setEditingId(application.id);
    setApplicationName(application.name);
    setOwner(application.owner);
    setDialogVisible(true);
  };

  const submitApplication = () => {
    const normalizedName = applicationName.trim();
    const normalizedOwner = owner.trim();

    if (!normalizedName || !normalizedOwner) {
      MessagePlugin.warning('请填写应用名称和负责人');
      return;
    }

    const duplicated = applications.some(
      ({ id, name }) => id !== editingId && name === normalizedName,
    );
    if (duplicated) {
      MessagePlugin.warning('应用名称已存在');
      return;
    }

    if (editingId === null) {
      const nextId = Math.max(0, ...applications.map(({ id }) => id)) + 1;
      setApplications((current) => [
        {
          id: nextId,
          name: normalizedName,
          owner: normalizedOwner,
          updatedAt: formatCurrentTime(),
          enabled: true,
        },
        ...current,
      ]);
      MessagePlugin.success('应用创建成功');
    } else {
      setApplications((current) => current.map((application) => (
        application.id === editingId
          ? {
            ...application,
            name: normalizedName,
            owner: normalizedOwner,
            updatedAt: formatCurrentTime(),
          }
          : application
      )));
      MessagePlugin.success('应用信息已更新');
    }

    closeDialog();
  };

  const toggleApplication = (application: AgentApplication, enabled: boolean) => {
    setApplications((current) => current.map((item) => (
      item.id === application.id
        ? { ...item, enabled, updatedAt: formatCurrentTime() }
        : item
    )));
    MessagePlugin.success(`${application.name}已${enabled ? '启用' : '停用'}`);
  };

  const columns: PrimaryTableCol<AgentApplication>[] = [
    {
      colKey: 'name',
      title: '应用名称',
      width: 280,
      cell: ({ row }) => <span className={styles.applicationName}>{row.name}</span>,
    },
    {
      colKey: 'owner',
      title: '负责人',
      width: 160,
    },
    {
      colKey: 'status',
      title: '状态',
      width: 140,
      cell: ({ row }) => (
        <Tag theme={row.enabled ? 'success' : 'default'} variant="light">
          {row.enabled ? '已启用' : '已停用'}
        </Tag>
      ),
    },
    {
      colKey: 'updatedAt',
      title: '更新时间',
      width: 190,
    },
    {
      colKey: 'operation',
      title: '操作',
      width: 190,
      cell: ({ row }) => (
        <Space size={16}>
          <Button theme="primary" variant="text" onClick={() => openEditDialog(row)}>
            编辑
          </Button>
          <Switch
            size="small"
            value={row.enabled}
            label={['启用', '停用']}
            onChange={(value) => toggleApplication(row, Boolean(value))}
          />
        </Space>
      ),
    },
  ];

  const search = () => {
    setAppliedKeyword(keyword);
    setAppliedStatus(status);
  };

  const reset = () => {
    setKeyword('');
    setStatus('all');
    setAppliedKeyword('');
    setAppliedStatus('all');
  };

  const retryList = () => {
    setListLoadState('loading');
    window.setTimeout(() => {
      setApplications(getScenarioApplications(previewScenario, game_id));
      setListLoadState('ready');
      MessagePlugin.success('应用列表已重新加载');
    }, 360);
  };

  const hasAppliedFilters = Boolean(appliedKeyword.trim()) || appliedStatus !== 'all';
  const listSummary = listLoadState === 'loading'
    ? '正在获取应用数量'
    : listLoadState === 'error'
      ? '暂时无法获取应用数量'
      : `共 ${filteredApplications.length} 个应用`;
  const emptyContent = hasAppliedFilters ? (
    <Empty
      action={<Button variant="outline" onClick={reset}>清除筛选条件</Button>}
      description="请调整应用名称或状态后重新查询"
      title="未找到符合条件的应用"
    />
  ) : (
    <Empty
      action={<Button theme="primary" onClick={openCreateDialog}>新建应用</Button>}
      description="创建首个应用后，可在这里统一管理启停状态和负责人"
      title="当前空间暂无应用"
    />
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>应用管理</h1>
          <p>管理当前空间内的智能体应用</p>
        </div>
        <Button theme="primary" onClick={openCreateDialog}>新建应用</Button>
      </div>

      <div className={styles.panel}>
        <div className={styles.filters}>
          <div className={styles.filterItem}>
            <span>应用名称</span>
            <Input
              value={keyword}
              clearable
              placeholder="请输入应用名称"
              onChange={(value) => setKeyword(value)}
              onEnter={search}
            />
          </div>
          <div className={styles.filterItem}>
            <span>状态</span>
            <Select
              value={status}
              options={statusOptions}
              onChange={(value) => setStatus(value)}
            />
          </div>
          <Space className={styles.filterActions}>
            <Button theme="primary" onClick={search}>查询</Button>
            <Button variant="outline" onClick={reset}>重置</Button>
          </Space>
        </div>

        <div className={styles.tableHeader}>
          <span>应用列表</span>
          <span>{listSummary}</span>
        </div>
        {listLoadState === 'error' ? (
          <div className={styles.tableState}>
            <Empty
              action={<Button theme="primary" onClick={retryList}>重新加载</Button>}
              description="请检查网络后重试，当前筛选条件已保留"
              title="应用列表加载失败"
              type="network-error"
            />
          </div>
        ) : (
          <Loading loading={listLoadState === 'loading'} text="应用列表加载中">
            <Table
              rowKey="id"
              data={filteredApplications}
              columns={columns}
              hover
              bordered={false}
              empty={listLoadState === 'loading' ? (
                <div className={styles.loadingPlaceholder} />
              ) : emptyContent}
            />
          </Loading>
        )}
      </div>

      <Dialog
        visible={dialogVisible}
        header={editingId === null ? '新建应用' : '编辑应用'}
        confirmBtn={editingId === null ? '创建' : '保存'}
        cancelBtn="取消"
        onConfirm={submitApplication}
        onClose={closeDialog}
      >
        <div className={styles.dialogForm}>
          <label>
            <span><i>*</i>应用名称</span>
            <Input
              value={applicationName}
              maxlength={30}
              placeholder="请输入应用名称"
              onChange={(value) => setApplicationName(value)}
            />
          </label>
          <label>
            <span><i>*</i>负责人</span>
            <Input
              value={owner}
              maxlength={20}
              placeholder="请输入负责人姓名"
              onChange={(value) => setOwner(value)}
              onEnter={submitApplication}
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
