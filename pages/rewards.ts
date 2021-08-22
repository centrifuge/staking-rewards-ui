import {ApiPromise} from "@polkadot/api";
import { BigNumber as BN } from 'bignumber.js';

export async function calculateValidator(api: ApiPromise, account: string, era: number) {

    const eraRewardPoints = await api.query.staking.erasRewardPoints(era);
    const eraRewardPointsTotal = Number(eraRewardPoints.toJSON()["total"]);
    const eraRewardPointsValidator = Number(eraRewardPoints.toJSON()["individual"][account]);
    if (!eraRewardPointsValidator) { // Not in validator set for that ERA
        return [0, 0, 0];
    }
    const eraRewardPointsPart = eraRewardPointsValidator/eraRewardPointsTotal;
    console.log("Era Reward Points Percentage", eraRewardPointsPart);
    const eraRewards: number = new BN(Number(await api.query.staking.erasValidatorReward(era))).toNumber();
    const rewardsForValidator: number = new BN(eraRewards).multipliedBy(eraRewardPointsPart).shiftedBy(-18).toNumber();
    console.log("Rewards Per Validator", rewardsForValidator);
    const valPrefs = await api.query.staking.erasValidatorPrefs(era, account);
    const commission: number = new BN(Number(valPrefs.toJSON()["commission"])).shiftedBy(-9).toNumber(); // check 9 decimal places
    console.log("Validator Commission", commission);
    const reward0 = commission * rewardsForValidator;
    console.log("Validator Reward0", reward0);
    const stakers = await api.query.staking.erasStakers(era, account);
    const validatorOwnStake = new BN(Number(stakers.toJSON()["own"])).shiftedBy(-18).toNumber();
    console.log("Validator Own stake", validatorOwnStake);
    const validatorTotalStake = new BN(Number(stakers.toJSON()["total"])).shiftedBy(-18).toNumber();
    console.log("Validator Total stake", validatorTotalStake);
    const ownRate = validatorOwnStake/validatorTotalStake;
    console.log("Validator Own Rate", ownRate);
    const reward1 = ownRate * (rewardsForValidator - reward0);
    console.log("Validator Reward1", reward1);

    return [reward0+reward1, reward0, reward1];
}

async function calculateRewardForNominators(api: ApiPromise, account: string, era: number) {
    const eraRewardPoints = await api.query.staking.erasRewardPoints(era);
    const eraRewardPointsTotal = Number(eraRewardPoints.toJSON()["total"]);
    const eraRewardPointsValidator = Number(eraRewardPoints.toJSON()["individual"][account]);
    const eraRewardPointsPart = eraRewardPointsValidator/eraRewardPointsTotal;
    console.log("Era Reward Points Percentage", eraRewardPointsPart);
    const eraRewards: number = new BN(Number(await api.query.staking.erasValidatorReward(era))).toNumber();
    const rewardsForValidator: number = new BN(eraRewards).multipliedBy(eraRewardPointsPart).shiftedBy(-18).toNumber();
    console.log("Rewards Per Validator", rewardsForValidator);
    const valPrefs = await api.query.staking.erasValidatorPrefs(era, account);
    const commission: number = new BN(Number(valPrefs.toJSON()["commission"])).shiftedBy(-9).toNumber(); // check 9 decimal places
    console.log("Validator Commission", commission);
    const reward0 = commission * rewardsForValidator;

    return rewardsForValidator-reward0;
}

export async function calculateNominator(api: ApiPromise, account: string, era: number) {
    const nominators = await api.query.staking.nominators(account);
    console.log(nominators);
    console.log(nominators.toJSON());
    if (!nominators.toJSON()) { // Not a nominator account
        return 0;
    }

    let totalNominator = 0;
    for (let i = 0; i < nominators.toJSON()["targets"].length; i++) {
        let item = nominators.toJSON()["targets"][i];
        const rewardNominators = await calculateRewardForNominators(api, item, era);
        const stakers = await api.query.staking.erasStakers(era, item);
        const nominatorEntry = stakers.toJSON()["others"].find(element => element.who == account);
        const nominatorValue = new BN(Number(nominatorEntry.value)).shiftedBy(-18).toNumber();
        const validatorTotalStake = new BN(Number(stakers.toJSON()["total"])).shiftedBy(-18).toNumber();
        const reward = rewardNominators * (nominatorValue / validatorTotalStake);
        console.log("Processed Validator", item, reward);
        totalNominator += reward;
    }

    return totalNominator;
}
