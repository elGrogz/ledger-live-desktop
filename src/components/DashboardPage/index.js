// @flow

import React, { PureComponent, Fragment } from 'react'
import { compose } from 'redux'
import { translate } from 'react-i18next'
import { connect } from 'react-redux'
import { push } from 'react-router-redux'

import chunk from 'lodash/chunk'
import get from 'lodash/get'
import random from 'lodash/random'
import sortBy from 'lodash/sortBy'
import takeRight from 'lodash/takeRight'

import type { MapStateToProps } from 'react-redux'
import type { Accounts } from 'types/common'

import { space } from 'styles/theme'

import { getVisibleAccounts } from 'reducers/accounts'

import { updateOrderAccounts } from 'actions/accounts'
import { saveSettings } from 'actions/settings'

import { AreaChart } from 'components/base/Chart'
import Box, { Card } from 'components/base/Box'
import Pills from 'components/base/Pills'
import Text from 'components/base/Text'
import TransactionsList from 'components/TransactionsList'

import AccountCard from './AccountCard'
import BalanceInfos from './BalanceInfos'
import AccountsOrder from './AccountsOrder'

const mapStateToProps: MapStateToProps<*, *, *> = state => ({
  accounts: getVisibleAccounts(state),
})

const mapDispatchToProps = {
  push,
  updateOrderAccounts,
  saveSettings,
}

type Props = {
  accounts: Accounts,
  push: Function,
}

type State = {
  accountsChunk: Array<any>,
  allTransactions: Array<Object>,
  fakeDatas: Array<any>,
  fakeDatasMerge: Array<any>,
  selectedTime: string,
}

const ACCOUNTS_BY_LINE = 3
const ALL_TRANSACTIONS_LIMIT = 10
const TIMEOUT_REFRESH_DATAS = 5e3

const itemsTimes = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
]

const generateFakeData = v => ({
  name: `Day ${v}`,
  value: random(10, 100),
})

const generateFakeDatas = accounts =>
  accounts.map(() => [...Array(25).keys()].map(v => generateFakeData(v + 1)))

const mergeFakeDatas = fakeDatas =>
  takeRight(
    fakeDatas.reduce((res, data) => {
      data.forEach((d, i) => {
        res[i] = {
          name: d.name,
          value: (res[i] ? res[i].value : 0) + d.value,
        }
      })
      return res
    }, []),
    25,
  )

const getAllTransactions = accounts => {
  const allTransactions = accounts.reduce((result, account) => {
    const transactions = get(account, 'data.transactions', [])

    result = [
      ...result,
      ...transactions.map(t => ({
        ...t,
        account: {
          id: account.id,
          name: account.name,
          type: account.type,
        },
      })),
    ]

    return result
  }, [])

  return sortBy(allTransactions, t => t.received_at)
    .reverse()
    .slice(0, ALL_TRANSACTIONS_LIMIT)
}

const getAccountsChunk = accounts => {
  // create shallow copy of accounts, to be mutated
  const listAccounts = [...accounts]

  while (listAccounts.length % ACCOUNTS_BY_LINE !== 0) listAccounts.push(null)

  return chunk(listAccounts, ACCOUNTS_BY_LINE)
}

class DashboardPage extends PureComponent<Props, State> {
  constructor(props) {
    super()

    const fakeDatas = generateFakeDatas(props.accounts)

    this.state = {
      accountsChunk: getAccountsChunk(props.accounts),
      allTransactions: getAllTransactions(props.accounts),
      fakeDatas: generateFakeDatas(props.accounts),
      fakeDatasMerge: mergeFakeDatas(fakeDatas),
      selectedTime: 'day',
    }
  }

  componentDidMount() {
    this._mounted = true

    this.addFakeDatasOnAccounts()
  }

  componentWillReceiveProps(nextProps) {
    if (this.state.fakeDatas.length === 0) {
      const fakeDatas = generateFakeDatas(nextProps.accounts)

      this.setState({
        fakeDatas,
        fakeDatasMerge: mergeFakeDatas(fakeDatas),
      })
    }

    if (nextProps.accounts !== this.props.accounts) {
      this.setState({
        accountsChunk: getAccountsChunk(nextProps.accounts),
        allTransactions: getAllTransactions(nextProps.accounts),
      })
    }
  }

  componentWillUnmount() {
    this._mounted = false
    clearTimeout(this._timeout)
  }

  addFakeDatasOnAccounts = () => {
    const { accounts } = this.props
    const { fakeDatas } = this.state

    const newFakeDatas = accounts.reduce((res, acc, i) => {
      if (res[i]) {
        const nextIndex = res[i].length
        res[i][nextIndex] = generateFakeData(nextIndex)
        res[i] = takeRight(res[i], 25)
      }
      return res
    }, fakeDatas)

    window.requestIdleCallback(() => {
      if (this._mounted) {
        this.setState({
          fakeDatas: newFakeDatas,
          fakeDatasMerge: mergeFakeDatas(newFakeDatas),
        })
      }

      this._timeout = setTimeout(() => {
        this.addFakeDatasOnAccounts()
      }, TIMEOUT_REFRESH_DATAS)
    })
  }

  _timeout = undefined
  _mounted = false

  render() {
    const { push, accounts } = this.props
    const { accountsChunk, allTransactions, selectedTime, fakeDatas, fakeDatasMerge } = this.state

    let accountIndex = 0
    const totalAccounts = accounts.length

    return (
      <Box flow={7}>
        <Box horizontal alignItems="flex-end">
          <Box>
            <Text color="dark" ff="Museo Sans" fontSize={7}>
              {'Good morning, Khalil.'}
            </Text>
            <Text color="grey" fontSize={5} ff="Museo Sans|Light">
              {totalAccounts > 0
                ? `here is the summary of your ${totalAccounts} accounts`
                : 'no accounts'}
            </Text>
          </Box>
          <Box ml="auto">
            <Pills
              items={itemsTimes}
              activeKey={selectedTime}
              onChange={item => this.setState({ selectedTime: item.key })}
            />
          </Box>
        </Box>
        {totalAccounts > 0 && (
          <Fragment>
            <Card flow={3} p={0} py={6}>
              <Box px={6}>
                <BalanceInfos since={selectedTime} />
              </Box>
              <Box ff="Open Sans" fontSize={4} color="warmGrey">
                <AreaChart
                  id="dashboard-chart"
                  margin={{
                    top: space[6],
                    bottom: 0,
                    left: space[6] - 10,
                    right: space[6],
                  }}
                  color="#5286f7"
                  height={250}
                  data={fakeDatasMerge}
                />
              </Box>
            </Card>
            <Box flow={4}>
              <Box horizontal alignItems="flex-end">
                <Text color="dark" ff="Museo Sans" fontSize={6}>
                  {'Accounts'}
                </Text>
                <Box ml="auto" horizontal flow={1}>
                  <AccountsOrder />
                </Box>
              </Box>
              <Box flow={5}>
                {accountsChunk.map((accountsByLine, i) => (
                  <Box
                    key={i} // eslint-disable-line react/no-array-index-key
                    horizontal
                    flow={5}
                  >
                    {accountsByLine.map(
                      (account: any, j) =>
                        account === null ? (
                          <Box
                            key={j} // eslint-disable-line react/no-array-index-key
                            p={4}
                            flex={1}
                          />
                        ) : (
                          <AccountCard
                            key={account.id}
                            account={account}
                            data={fakeDatas[accountIndex++]}
                            onClick={() => push(`/account/${account.id}`)}
                          />
                        ),
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
            <Card p={0} px={4} title="Recent activity">
              <TransactionsList
                withAccounts
                transactions={allTransactions}
                onAccountClick={account => push(`/account/${account.id}`)}
              />
            </Card>
          </Fragment>
        )}
      </Box>
    )
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps), translate())(DashboardPage)
