/* I need to write frontend code to interact with my backend 

*/
"use client";

import {
  getJournalProgram,
  getJournalProgramId,
  JournalIDL,
} from "@journal/anchor";
import { Program } from "@coral-xyz/anchor";
import { useConnection } from "@solana/wallet-adapter-react";
import { Cluster, PublicKey } from "@solana/web3.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useCluster } from "../cluster/cluster-data-access";
import { useAnchorProvider } from "../solana/solana-provider";
import { useTransactionToast } from "../ui/ui-layout";
import { useMemo } from "react";
import { get } from "http";

interface CreateEntryArgs {
  title: string;
  message: string;
  owner: PublicKey;
}

export function useJournalProgram() {
  // needed to connect to rpc node
  const { connection } = useConnection();
  // we need to knwo the cluster we are one , so we can know our program id for that cluster
  const { cluster } = useCluster();
  // we need to show a toast when a transaction is successful
  const transactionToast = useTransactionToast();
  // we need to get the provider for the anchor program
  const provider = useAnchorProvider();
  // Here, the function inside is heavy, we dont want to call it on every render, so useMemo caches the result
  const programId = useMemo(
    () => getJournalProgramId(cluster.network as Cluster),
    [cluster]
  );
  // program needs IDL , but the function we are usign already has IDL 
  const program = getJournalProgram(provider);
  // we need to get all the accounts for the journal program, they are of type JournalEntryState, useQuery is used for managing memory efficeinety (caching)
  const accounts = useQuery({
    queryKey: ["journal", "all", { cluster }],
    queryFn: () => program.account.journalEntryState.all(),
  });
  // we need to get the program account for the journal program, useQuery is used for managing memory efficeinety (caching), this is not needed really , unless we have a use case
  const getProgramAccount = useQuery({
    queryKey: ["get-program-account", { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  });
  // query is kind og get only , mutation is for create, update, delete
  const createEntry = useMutation<string, Error, CreateEntryArgs>({
    mutationKey: ["journalEntry", "create", { cluster }],
    // redundant function here , but we can use this along with connection.getParsedAccountInfo(programId) to get specific journal account data
    mutationFn: async ({ title, message, owner }) => {
      const [journalEntryAddress] = await PublicKey.findProgramAddress(
        [Buffer.from(title), owner.toBuffer()],
        programId
      );
      // only useful line, straightforward liek calling a function
      return program.methods.createJournalEntry(title, message).rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      accounts.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create journal entry: ${error.message}`);
    },
  });
  // These are returned from the program hook , maybe some of them look unnecessary over here , but when we are usign this hook , it reduces other imports 
  return {
    program,
    programId,
    accounts,
    getProgramAccount,
    createEntry,
  };
}

// what is this { account }: { account: PublicKey }, how will it be called?
export function useJournalProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster();
  const transactionToast = useTransactionToast();
  // we need to get the program and accounts from the journal program hook
  const { program, accounts } = useJournalProgram();
  // didn't get why they used a new PublicKey here , when we already have programId from the journal program hook
  const programId = new PublicKey(
    "8sddtWW1q7fwzspAfZj4zNpeQjpvmD3EeCCEfnc3JnuP"
  );
  // insted of fetch.all(), we can use fetch() to get a specific account
  const accountQuery = useQuery({
    queryKey: ["journal", "fetch", { cluster, account }],
    queryFn: () => program.account.journalEntryState.fetch(account),
  });
  // same as createEntry
  const updateEntry = useMutation<string, Error, CreateEntryArgs>({
    mutationKey: ["journalEntry", "update", { cluster }],
    mutationFn: async ({ title, message, owner }) => {
      const [journalEntryAddress] = await PublicKey.findProgramAddress(
        [Buffer.from(title), owner.toBuffer()],
        programId
      );

      return program.methods.updateJournalEntry(title, message).rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      accounts.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update journal entry: ${error.message}`);
    },
  });
  // doubt? why is this not a useMutation<string, Error, string>
  const deleteEntry = useMutation({
    mutationKey: ["journal", "deleteEntry", { cluster, account }],
    mutationFn: (title: string) =>
      program.methods.deleteJournalEntry(title).rpc(),
    onSuccess: (tx) => {
      transactionToast(tx);
      return accounts.refetch();
    },
  });

  return {
    accountQuery,
    updateEntry,
    deleteEntry,
  };
}
